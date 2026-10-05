import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell subtitle="We'll email you a secure reset link.">
      <AuthForm mode="forgot" />
      <p className="text-center mt-6">
        <Link
          href="/signin"
          className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink transition-colors"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
