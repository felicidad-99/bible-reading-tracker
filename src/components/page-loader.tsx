export function PageLoader({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? "min-h-dvh flex flex-col items-center justify-center gap-3"
          : "min-h-[50vh] flex flex-col items-center justify-center gap-3 py-16"
      }
    >
      <span
        aria-hidden
        className="size-8 rounded-full border-[3px] border-surface-sunken border-t-accent animate-spin motion-reduce:animate-none"
      />
      <span className="text-sm text-ink-muted">Loading…</span>
      <span className="sr-only">Loading page</span>
    </div>
  );
}
