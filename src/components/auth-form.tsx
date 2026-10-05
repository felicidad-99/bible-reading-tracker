"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function AuthForm({ mode }: { mode: "signin" | "signup" | "forgot" | "reset" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create account");

        const signInRes = await fetch("/api/auth/callback/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            email,
            password,
            csrfToken: await getCsrfToken(),
            callbackUrl: "/onboarding",
            json: "true",
          }),
        });
        if (!signInRes.ok) {
          router.push("/signin");
          return;
        }
        router.push("/onboarding");
        router.refresh();
        return;
      }

      if (mode === "signin") {
        const res = await fetch("/api/auth/callback/credentials", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            email,
            password,
            csrfToken: await getCsrfToken(),
            callbackUrl: "/dashboard",
            json: "true",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.url?.includes("error")) {
          throw new Error("Invalid email or password");
        }
        const url = data?.url as string | undefined;
        router.push(url && !url.includes("/api/auth") ? new URL(url).pathname : "/dashboard");
        router.refresh();
        return;
      }

      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Could not send reset email");
        }
        setInfo("If that email exists, a reset link is on its way.");
        return;
      }

      if (mode === "reset") {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not reset password");
        setInfo("Password updated. You can sign in now.");
        setTimeout(() => router.push("/signin"), 1200);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 w-full">
      {mode === "signup" && (
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Optional"
          />
        </div>
      )}

      {mode !== "reset" && (
        <div>
          <label className="label" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
      )}

      {mode === "reset" && (
        <div>
          <label className="label" htmlFor="token">Reset token</label>
          <input
            id="token"
            required
            className="input"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Paste token from email"
          />
          <p className="text-sm text-ink-muted mt-1">
            Or open the link from your email directly.
          </p>
        </div>
      )}

      {(mode === "signin" || mode === "signup" || mode === "reset") && (
        <div>
          <label className="label" htmlFor="password">
            Password {mode !== "reset" && <span className="text-ink-muted">(min 8 chars)</span>}
          </label>
          <div className="relative flex items-center">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              className="input pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1.5 w-9 h-9 flex items-center justify-center rounded-full text-ink-muted hover:text-ink transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          </div>
          {mode === "signin" && (
            <div className="flex justify-end pt-2">
              <Link
                href="/forgot-password"
                className="text-sm text-ink-muted hover:text-ink transition-colors duration-150"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">{error}</p>
      )}
      {info && (
        <p role="status" className="text-sm text-success">{info}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full rounded-full py-3.5 text-base justify-center"
      >
        {loading
          ? "Working…"
          : mode === "signin"
            ? "Sign in"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send reset link"
                : "Reset password"}
      </button>
    </form>
  );
}

async function getCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/csrf");
    const data = await res.json();
    return data.csrfToken ?? "";
  } catch {
    return "";
  }
}
