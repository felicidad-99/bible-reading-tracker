import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <Link href="/signin" className="text-sm text-ink-muted mb-8 hover:text-ink">
        ← Back to sign in
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          Reset your password
        </h1>
        <p className="text-sm text-ink-muted text-center mt-2 mb-8">
          We&apos;ll email you a secure reset link.
        </p>
        <AuthForm mode="forgot" />
      </div>
    </div>
  );
}
