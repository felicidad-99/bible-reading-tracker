import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <AuthShell subtitle="Save your plan, progress, and reading streak.">
      <AuthForm mode="signup" />

      <div
        className="relative flex items-center justify-center my-4"
        aria-hidden="true"
      >
        <div className="w-full border-t border-line" />
        <span className="absolute bg-surface px-3 text-sm text-ink-subtle">
          or
        </span>
      </div>

      <Link
        href="/signin"
        className="btn btn-secondary w-full rounded-full py-3.5 text-base justify-center"
      >
        Sign in
      </Link>
    </AuthShell>
  );
}
