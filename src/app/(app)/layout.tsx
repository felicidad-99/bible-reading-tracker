import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ReminderProvider } from "@/components/reminder-provider";

export default async function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <AppShell>
      <ReminderProvider>{children}</ReminderProvider>
    </AppShell>
  );
}
