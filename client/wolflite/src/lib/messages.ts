import { useEffect, useState } from "react";
import { api } from "./api";
import { pollWhileVisible } from "./poll";

/*
  Direct messages: client side of the /dm API.
  The full contract (request / response shapes, rules) is in docs/direct-messages-api.md.

  New messages arrive by polling for now (see POLL_THREAD_MS). When the server
  pushes messages over a WebSocket, call `onIncoming` from the socket handler
  and lower / remove the polling.
*/

export const MAX_MESSAGE_LENGTH = 2000;
// While a conversation is open, check for new messages this often
export const POLL_THREAD_MS = 4000;
// Conversation list / unread badge refresh
export const POLL_LIST_MS = 30000;

export interface DmUser {
  id: number;
  username: string;
  profilePic: string | null;
}

export interface DirectMessage {
  id: number;
  conversationId: number;
  senderId: number;
  body: string;
  /** ISO / HTTP date string */
  created: string;
}

export interface Conversation {
  id: number;
  /** The person you're talking to */
  otherUser: DmUser;
  lastMessage: DirectMessage | null;
  /** Messages from them you haven't read */
  unreadCount: number;
  /** When the last message was sent (or the conversation was created) */
  updated: string;
}

/** GET /dm/conversations: newest activity first */
export async function listConversations(): Promise<{ conversations: Conversation[]; unreadTotal: number }> {
  const data = await api("/dm/conversations");
  return { conversations: data.conversations ?? [], unreadTotal: data.unreadTotal ?? 0 };
}

/** POST /dm/conversations: the conversation with this user, created if it doesn't exist yet */
export async function openConversation(userId: number): Promise<Conversation> {
  const data = await api("/dm/conversations", { method: "POST", json: { userId } });
  return data.conversation;
}

/**
 * GET /dm/conversations/<id>/messages: oldest first.
 * Pass `before` (a message id) to load older messages; `after` to load only newer ones.
 */
export async function listMessages(
  conversationId: number,
  { before, after }: { before?: number; after?: number } = {}
): Promise<{ messages: DirectMessage[]; hasMore: boolean }> {
  const params = new URLSearchParams();
  if (before) params.set("before", String(before));
  if (after) params.set("after", String(after));
  const query = params.toString() ? `?${params}` : "";
  const data = await api(`/dm/conversations/${conversationId}/messages${query}`);
  return { messages: data.messages ?? [], hasMore: !!data.hasMore };
}

/** POST /dm/conversations/<id>/messages */
export async function sendMessage(conversationId: number, body: string): Promise<DirectMessage> {
  const data = await api(`/dm/conversations/${conversationId}/messages`, { method: "POST", json: { body } });
  return data.message;
}

/** PUT /dm/conversations/<id>/read: marks everything in it as read for you */
export async function markConversationRead(conversationId: number) {
  await api(`/dm/conversations/${conversationId}/read`, { method: "PUT" });
}

/**
 * Unread message count for the navbar badge (logged in users only; pass enabled = false
 * for guests). Refreshes every POLL_LIST_MS. Errors (e.g. API not set up yet) show 0.
 */
export function useUnreadMessages(enabled: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () =>
      listConversations()
        .then((data) => active && setCount(data.unreadTotal))
        .catch(() => active && setCount(0));
    load();
    // Paused while the tab is hidden; catches up when it's visible again
    const stopPolling = pollWhileVisible(load, POLL_LIST_MS);
    // Opening a conversation on the messages page updates the badge right away
    const onRead = () => load();
    window.addEventListener("wolflite:messages-read", onRead);
    return () => {
      active = false;
      stopPolling();
      window.removeEventListener("wolflite:messages-read", onRead);
    };
  }, [enabled]);

  return count;
}

/** Tell the navbar badge to refresh (after reading a conversation) */
export const announceMessagesRead = () => window.dispatchEvent(new Event("wolflite:messages-read"));

export const messagesHref = (userId?: number) => (userId ? `/messages?user=${userId}` : "/messages");
