import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bible Reading Tracker",
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-line">
        <div className="max-w-5xl mx-auto px-4 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold tracking-tight text-lg">Bible Tracker</span>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Link href="/signin" className="btn btn-ghost text-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary text-sm">
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <p className="eyebrow fade-up">Bible Reading Tracker</p>
          <h1 className="mt-4 text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl fade-up fade-up-delay-1">
            Read the Bible. Build the habit. Finish what you started.
          </h1>
          <p className="mt-6 text-lg text-ink-muted max-w-xl leading-relaxed fade-up fade-up-delay-2">
            Create a plan that fits your pace, track every chapter, and read
            Scripture right inside the app. Gentle reminders keep you going
            without the guilt.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 fade-up fade-up-delay-3">
            <Link href="/signup" className="btn btn-primary px-7 py-3.5 text-base">
              Create Reading Plan
            </Link>
            <Link href="/signin" className="btn btn-secondary px-7 py-3.5 text-base">
              Sign in
            </Link>
          </div>

          <dl className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl">
            {[
              ["1,189 chapters", "Every book, allocated once. No skips, no duplicates."],
              ["Your schedule", "Once, twice, or three times a day at times you choose."],
              ["Built-in reader", "Open today's passage and mark it done as you go."],
            ].map(([title, body], i) => (
              <div key={title} className={`card p-5 fade-up fade-up-delay-${i + 1}`}>
                <dt className="font-medium text-sm">{title}</dt>
                <dd className="mt-1.5 text-sm text-ink-muted leading-relaxed">{body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <footer className="border-t border-line py-8">
        <div className="max-w-5xl mx-auto px-4 text-sm text-ink-subtle">
          Scripture via Free Use Bible API. Public-domain translations preferred.
        </div>
      </footer>
    </div>
  );
}
