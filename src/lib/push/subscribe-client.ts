export interface PushConfig {
  configured: boolean;
  publicKey: string | null;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function b64url(bytes: ArrayBuffer | null): string {
  if (!bytes) return "";
  const bytesArr = new Uint8Array(bytes);
  let raw = "";
  for (let i = 0; i < bytesArr.length; i++) {
    raw += String.fromCharCode(bytesArr[i]);
  }
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    typeof Notification !== "undefined"
  );
}

export async function getPushConfig(): Promise<PushConfig> {
  const res = await fetch("/api/push/subscribe");
  const data = (await res.json()) as PushConfig;
  return { configured: Boolean(data.configured), publicKey: data.publicKey ?? null };
}

export async function getActiveSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function registerAndSubscribe(
  publicKey: string
): Promise<PushSubscription> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

export async function saveSubscription(sub: PushSubscription): Promise<boolean> {
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
  return res.ok;
}

export async function enablePush(
  publicKey: string
): Promise<{ ok: boolean; note: string }> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        note: permission === "denied" ? "denied" : "Permission not granted.",
      };
    }
    const existing = await getActiveSubscription();
    const sub = existing ?? (await registerAndSubscribe(publicKey));
    const saved = await saveSubscription(sub);
    if (!saved) return { ok: false, note: "Failed to save subscription" };
    return { ok: true, note: "Push notifications enabled." };
  } catch (err) {
    return {
      ok: false,
      note: err instanceof Error ? err.message : "Failed to enable push",
    };
  }
}

export async function disablePush(): Promise<{ ok: boolean; note: string }> {
  try {
    const sub = await getActiveSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    return { ok: true, note: "Push notifications disabled." };
  } catch {
    return { ok: false, note: "Failed to disable push" };
  }
}

export async function resyncSubscription(): Promise<void> {
  try {
    if (!pushSupported()) return;
    if (Notification.permission !== "granted") return;
    const config = await getPushConfig();
    if (!config.configured || !config.publicKey) return;
    const existing = await getActiveSubscription();
    if (existing) return;
    const sub = await registerAndSubscribe(config.publicKey);
    await saveSubscription(sub);
  } catch {
    // silent: retried on next launch
  }
}
