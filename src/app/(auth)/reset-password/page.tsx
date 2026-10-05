import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell subtitle="Open the email link to auto-fill the token, or paste it below.">
      {token && (
        <p className="text-sm font-mono break-all text-center text-ink-muted mb-4">
          {token}
        </p>
      )}
      <AuthForm mode="reset" />
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
