import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="text-sm text-ink-muted mb-8 hover:text-ink">
        ← Bible Tracker
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          Create your account
        </h1>
        <p className="text-sm text-ink-muted text-center mt-2 mb-8">
          Save your plan, progress, and reading streak.
        </p>
        <AuthForm mode="signup" />
        <p className="mt-6 text-sm text-ink-muted text-center">
          Already have an account?{" "}
          <Link href="/signin" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
