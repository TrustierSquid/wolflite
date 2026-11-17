import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

/**
 * den_removed  removed from a den      mention  @username in a post / poll / comment
 * reply        reply to your comment   comment  comment on your post / poll
 * dm           direct message (coming later)
 */
export type NotificationType = "den_removed" | "mention" | "reply" | "comment" | "dm";

/** One notification, as GET /notifications returns it */
export interface AppNotification {
  id: number;
  type: NotificationType;
  isRead: boolean;
  created: string;
  /** Who caused it; null if their account was deleted */
  actor: { id: number; username: string; profilePic: string | null } | null;
  /** The den it happened in (its name is kept even if the den was deleted) */
  den: { id: number; name: string; exists: boolean } | null;
  postId: number | null;
  pollId: number | null;
  commentId: number | null;
  /** Start of the text that mentioned you */
  snippet: string | null;
}

interface NotificationsState {
  notifications: AppNotification[] | null; // null until the first load
  unreadCount: number;
  error: string | null;
}

/*
  One shared copy of the logged in user's notifications for the whole page, so
  the side panel and the navbar bell (narrow screens) show the same thing and
  only one of them polls the server.
  Refreshes every minute and whenever the tab gets focus again.
*/
const REFRESH_EVERY_MS = 60_000;

let state: NotificationsState = { notifications: null, unreadCount: 0, error: null };
const listeners = new Set<() => void>();
let users = 0;
let timer: number | undefined;

function setState(changes: Partial<NotificationsState>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

export async function refreshNotifications() {
  try {
    const data = await api("/notifications");
    setState({ notifications: data.notifications ?? [], unreadCount: data.unreadCount ?? 0, error: null });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : "Couldn't load notifications" });
  }
}

const onFocus = () => refreshNotifications();

// Start polling while at least one component shows notifications
function start() {
  users += 1;
  if (users > 1) return;
  refreshNotifications();
  timer = window.setInterval(refreshNotifications, REFRESH_EVERY_MS);
  window.addEventListener("focus", onFocus);
}

function stop() {
  users -= 1;
  if (users > 0) return;
  window.clearInterval(timer);
  window.removeEventListener("focus", onFocus);
}

/**
 * The logged in user's notifications. Pass enabled = false for guests (nothing is fetched).
 */
export function useNotifications(enabled = true) {
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );

  useEffect(() => {
    if (!enabled) return;
    start();
    return stop;
  }, [enabled]);

  return snapshot;
}

/** Marks one notification read (updates the panel straight away) */
export async function markNotificationRead(notification: AppNotification) {
  if (notification.isRead) return;
  setState({
    notifications: state.notifications?.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)) ?? null,
    unreadCount: Math.max(0, state.unreadCount - 1),
  });
  await api(`/notifications/${notification.id}/read`, { method: "PUT" }).catch(() => refreshNotifications());
}

export async function markAllNotificationsRead() {
  setState({ notifications: state.notifications?.map((n) => ({ ...n, isRead: true })) ?? null, unreadCount: 0 });
  await api("/notifications/read", { method: "PUT" }).catch(() => refreshNotifications());
}

/** Deletes all of the logged in user's notifications */
export async function clearAllNotifications() {
  setState({ notifications: [], unreadCount: 0 });
  await api("/notifications", { method: "DELETE" }).catch(() => refreshNotifications());
}

export async function dismissNotification(notification: AppNotification) {
  setState({
    notifications: state.notifications?.filter((n) => n.id !== notification.id) ?? null,
    unreadCount: notification.isRead ? state.unreadCount : Math.max(0, state.unreadCount - 1),
  });
  await api(`/notifications/${notification.id}`, { method: "DELETE" }).catch(() => refreshNotifications());
}
