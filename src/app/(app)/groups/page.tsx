"use client";

import Link from "next/link";
import { useState } from "react";
import { GroupsSection, JoinGroupCard } from "@/components/groups-section";

export default function GroupsPage() {
  const [tab, setTab] = useState<"mine" | "discover">("mine");

  return (
    <div className="max-w-md mx-auto md:max-w-xl lg:max-w-3xl">
      <nav
        aria-label="Top bar"
        className="sticky top-0 z-20 h-14 -mx-4 md:-mx-8 px-4 md:px-8 flex items-center justify-between border-b border-line bg-surface/90 backdrop-blur-md"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="material-symbols-outlined text-[22px] text-accent-ink shrink-0"
            aria-hidden="true"
          >
            groups
          </span>
          <h1 className="text-xl font-semibold tracking-tight truncate">Community</h1>
        </div>
        <Link
          href="/groups/new"
          className="min-h-11 px-3.5 rounded-lg border border-line text-accent-ink text-sm font-medium flex items-center gap-1 hover:bg-surface-sunken transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          New
        </Link>
      </nav>

      <div className="pt-4 pb-8 space-y-5">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-sandstone">
            Together in Scripture
          </p>
          <h2 className="text-3xl font-semibold tracking-tight mt-0.5">Shared Reading</h2>
          <p className="text-sm text-ink-muted mt-1 leading-relaxed">
            Walk through the Word alongside friends, small groups, and church
            companions with synchronized pacing.
          </p>
        </section>

        <div
          className="bg-surface-sunken p-1 rounded-full flex items-center"
          role="tablist"
          aria-label="Groups view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "mine"}
            onClick={() => setTab("mine")}
            className={`flex-1 min-h-11 rounded-full text-sm font-medium transition-all ${
              tab === "mine"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            My groups
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "discover"}
            onClick={() => setTab("discover")}
            className={`flex-1 min-h-11 rounded-full text-sm font-medium transition-all ${
              tab === "discover"
                ? "bg-surface-raised text-ink shadow-sm"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Discover
          </button>
        </div>

        {tab === "mine" ? (
          <GroupsSection variant="full" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
            <section className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-11 h-11 rounded-lg bg-verdant-soft text-verdant flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-[22px]">group_add</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-ink">Start a new circle</p>
                  <p className="text-sm text-ink-muted mt-0.5 truncate">
                    Create a group and invite friends with a code.
                  </p>
                </div>
              </div>
              <Link href="/groups/new" className="btn btn-primary text-sm shrink-0">
                Create
              </Link>
            </section>

            <JoinGroupCard />
          </div>
        )}
      </div>
    </div>
  );
}
