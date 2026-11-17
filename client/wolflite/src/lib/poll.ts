/**
 * Calls `check` every `ms` milliseconds, but only while the tab is visible.
 * While the tab is in the background (minimized, another tab open) nothing is
 * sent; when it becomes visible again `check` runs right away, then on the
 * usual schedule. Returns a function that stops it.
 *
 * Used for everything that refreshes in the background: the open conversation
 * (4 s), the conversation list and unread badge (30 s), notifications (60 s).
 */
export function pollWhileVisible(check: () => unknown, ms: number): () => void {
  const timer = window.setInterval(() => {
    if (!document.hidden) check();
  }, ms);

  const onVisibility = () => {
    if (!document.hidden) check();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
