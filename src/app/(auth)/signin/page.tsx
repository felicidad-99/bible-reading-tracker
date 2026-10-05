import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <AuthShell valueProps>
      <AuthForm mode="signin" />

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
        href="/signup"
        className="btn btn-secondary w-full rounded-full py-3.5 text-base justify-center"
      >
        Create an account
      </Link>
    </AuthShell>
  );
}
