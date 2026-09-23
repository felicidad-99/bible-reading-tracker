import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="text-sm text-ink-muted mb-8 hover:text-ink">
        ← Bible Tracker
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          Welcome back
        </h1>
        <p className="text-sm text-ink-muted text-center mt-2 mb-8">
          Sign in to continue your reading plan.
        </p>
        <AuthForm mode="signin" />
        <div className="mt-6 flex flex-col items-center gap-2 text-sm">
          <Link href="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
          <p className="text-ink-muted">
            New here?{" "}
            <Link href="/signup" className="text-accent hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
