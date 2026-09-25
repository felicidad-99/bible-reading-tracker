import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      <Link href="/signin" className="text-sm text-ink-muted mb-8 hover:text-ink">
        Back to sign in
      </Link>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-center">
          Choose a new password
        </h1>
        <p className="text-sm text-ink-muted text-center mt-2 mb-6">
          Open the email link to auto-fill the token, or paste it below.
        </p>
        {token && (
          <p className="text-sm font-mono break-all text-center text-ink-subtle mb-4">
            {token}
          </p>
        )}
        <AuthForm mode="reset" />
      </div>
    </div>
  );
}
