"use client";

import { useEffect, useState } from "react";
import {
  enablePush,
  getActiveSubscription,
  getPushConfig,
  pushSupported,
} from "@/lib/push/subscribe-client";

const DISMISS_KEY = "push-prompt-dismissed";

export function PushPromptCard() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!pushSupported()) return;
      if (localStorage.getItem(DISMISS_KEY)) return;
      if (Notification.permission !== "default") return;
      try {
        const config = await getPushConfig();
        if (cancelled || !config.configured || !config.publicKey) return;
        const sub = await getActiveSubscription();
        if (cancelled || sub) return;
        setVisible(true);
      } catch {
        // hidden by default
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function allow() {
    setBusy(true);
    setNote(null);
    try {
      const config = await getPushConfig();
      if (!config.configured || !config.publicKey) {
        setVisible(false);
        return;
      }
      const result = await enablePush(config.publicKey);
      if (result.ok) {
        setVisible(false);
      } else {
        setNote(
          result.note === "denied"
            ? "Notifications are blocked. Allow them in your browser settings, then reload."
            : result.note
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="card p-5 border-accent/40 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">Never miss a reading</p>
          <p className="text-sm text-ink-muted mt-0.5">
            Turn on notifications to get reminders when your reading is coming
            up — even when the app is closed.
          </p>
          {note && (
            <p role="status" className="mt-2 text-sm text-danger">
              {note}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={allow}
            disabled={busy}
          >
            {busy ? "Enabling…" : "Enable notifications"}
          </button>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={dismiss}
            disabled={busy}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
