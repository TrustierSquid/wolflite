import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import Avatar from "../components/Avatar";
import MentionText from "../components/MentionText";
import SearchBox from "../components/SearchBox";
import Status from "../components/Status";
import { api } from "../lib/api";
import { useRequiredUser } from "../lib/currentUser";
import type { CurrentUser } from "../lib/currentUser";
import {
  MAX_MESSAGE_LENGTH,
  POLL_LIST_MS,
  POLL_THREAD_MS,
  announceMessagesRead,
  listConversations,
  listMessages,
  markConversationRead,
  openConversation,
  sendMessage,
} from "../lib/messages";
import type { Conversation, DirectMessage, DmUser } from "../lib/messages";
import { pollWhileVisible } from "../lib/poll";
import { matchesSearch } from "../lib/search";
import { formatDate, timeAgo } from "../lib/time";

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");
const clockTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();

/** A message on screen: sent ones, plus ones still sending or that failed */
interface ShownMessage extends DirectMessage {
  pending?: "sending" | "failed";
}

// Keep the conversation in the URL (/messages?c=12) so refresh / back work
function setConversationInUrl(id: number | null) {
  window.history.replaceState(null, "", id ? `/messages?c=${id}` : "/messages");
}

/*
  /messages             conversation list (and an empty chat pane)
  /messages?c=12        that conversation open
  /messages?user=5      opens (or starts) the conversation with user 5, e.g. from their profile
*/
export default function MessagesPage() {
  const me = useRequiredUser(); // sends guests to the login page
  const params = new URLSearchParams(window.location.search);

  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(Number(params.get("c")) || null);
  const [listError, setListError] = useState<StatusMessage | null>(null);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const startWithUser = Number(params.get("user")) || null;

  const loadConversations = useCallback(async () => {
    try {
      const data = await listConversations();
      setConversations(data.conversations);
      setListError(null);
    } catch (err) {
      setListError({ type: "error", text: errorText(err) });
      setConversations((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    if (!me) return;
    loadConversations();
    return pollWhileVisible(loadConversations, POLL_LIST_MS);
  }, [me, loadConversations]);

  const select = useCallback((conversation: Conversation) => {
    // Add it to the list if it's brand new, and open it
    setConversations((prev) => (prev?.some((c) => c.id === conversation.id) ? prev : [conversation, ...(prev ?? [])]));
    setActiveId(conversation.id);
    setConversationInUrl(conversation.id);
  }, []);

  // /messages?user=5: open (or start) that conversation
  useEffect(() => {
    if (!me || !startWithUser) return;
    if (startWithUser === me.id) return;
    openConversation(startWithUser)
      .then(select)
      .catch((err) => setListError({ type: "error", text: errorText(err) }));
  }, [me, startWithUser, select]);

  function back() {
    setActiveId(null);
    setConversationInUrl(null);
  }

  // After sending / receiving: move the conversation to the top with its new last message
  const updateConversation = useCallback((id: number, changes: Partial<Conversation>) => {
    setConversations((prev) => {
      if (!prev) return prev;
      const updated = prev.map((c) => (c.id === id ? { ...c, ...changes } : c));
      return updated.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
    });
  }, []);

  if (!me) {
    return (
      <main className="page">
        <span className="loader" role="status" aria-label="Loading"></span>
      </main>
    );
  }

  const active = conversations?.find((c) => c.id === activeId) ?? null;
  const shown = conversations?.filter((c) => matchesSearch(c.otherUser.username, query)) ?? null;

  return (
    <main className="messages-page">
      <div className={`card messages-shell${activeId ? " has-active" : ""}`}>
        {/* ---------- Conversation list ---------- */}
        <aside className="conv-pane" aria-label="Conversations">
          <div className="conv-header">
            <h1 className="conv-title">
              <i className="fa-solid fa-message" aria-hidden="true"></i> Messages
            </h1>
            <button type="button" className="icon-btn" onClick={() => setNewOpen(true)} aria-label="New message" title="New message">
              <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i>
            </button>
          </div>

          {conversations && conversations.length > 0 && (
            <SearchBox value={query} onChange={setQuery} label="Search conversations" className="conv-search" />
          )}

          <Status status={listError} />

          <div className="conv-list">
            {shown === null ? (
              <span className="loader" role="status" aria-label="Loading conversations"></span>
            ) : conversations!.length === 0 ? (
              <div className="conv-empty">
                <i className="fa-regular fa-comments" aria-hidden="true"></i>
                <p>No conversations yet.</p>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setNewOpen(true)}>
                  <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> New message
                </button>
              </div>
            ) : shown.length === 0 ? (
              <p className="conv-empty">No conversations with “{query.trim()}”.</p>
            ) : (
              <ul>
                {shown.map((conversation) => (
                  <li key={conversation.id}>
                    <ConversationRow
                      conversation={conversation}
                      me={me}
                      active={conversation.id === activeId}
                      onSelect={() => select(conversation)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* ---------- Open conversation ---------- */}
        <section className="thread-pane" aria-label={active ? `Conversation with ${active.otherUser.username}` : "Conversation"}>
          {active ? (
            <Thread
              key={active.id}
              conversation={active}
              me={me}
              onBack={back}
              onActivity={(changes) => updateConversation(active.id, changes)}
            />
          ) : activeId && conversations === null ? (
            <span className="loader" role="status" aria-label="Loading conversation"></span>
          ) : (
            <div className="thread-empty">
              <i className="fa-regular fa-paper-plane" aria-hidden="true"></i>
              <h2 className="section-title">Your messages</h2>
              <p>Pick a conversation, or start a new one.</p>
              <button type="button" className="btn btn-primary" onClick={() => setNewOpen(true)}>
                <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> New message
              </button>
            </div>
          )}
        </section>
      </div>

      {newOpen && (
        <NewMessageModal
          me={me}
          onClose={() => setNewOpen(false)}
          onPick={(conversation) => {
            setNewOpen(false);
            select(conversation);
          }}
        />
      )}
    </main>
  );
}


// One conversation in the list: picture, name, last message, time, unread count
function ConversationRow({ conversation, me, active, onSelect }: { conversation: Conversation; me: CurrentUser; active: boolean; onSelect: () => void }) {
  const { otherUser, lastMessage, unreadCount } = conversation;
  const preview = lastMessage
    ? `${lastMessage.senderId === me.id ? "You: " : ""}${lastMessage.body.replace(/\s+/g, " ")}`
    : "No messages yet";

  return (
    <button
      type="button"
      className={`conv-row${active ? " is-active" : ""}${unreadCount > 0 ? " is-unread" : ""}`}
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
    >
      <Avatar src={otherUser.profilePic} size={44} />
      <span className="conv-row-info">
        <span className="conv-row-top">
          <span className="conv-row-name">{otherUser.username}</span>
          <span className="conv-row-time">{timeAgo(conversation.updated)}</span>
        </span>
        <span className="conv-row-bottom">
          <span className="conv-row-preview">{preview}</span>
          {unreadCount > 0 && (
            <span className="conv-row-badge" aria-label={`${unreadCount} unread`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}


interface ThreadProps {
  conversation: Conversation;
  me: CurrentUser;
  onBack: () => void;
  /** New last message / read state, for the conversation list */
  onActivity: (changes: Partial<Conversation>) => void;
}

// The open conversation: header, messages (grouped by day and sender), composer
function Thread({ conversation, me, onBack, onActivity }: ThreadProps) {
  const { otherUser } = conversation;
  const [messages, setMessages] = useState<ShownMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<StatusMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // How to place the scroll after the next render: "bottom", or keep the view still
  // after older messages were added on top
  const scrollIntent = useRef<{ type: "bottom" } | { type: "keep"; fromBottom: number } | null>(null);
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const nearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const markRead = useCallback(() => {
    markConversationRead(conversation.id)
      .then(() => {
        onActivityRef.current({ unreadCount: 0 });
        announceMessagesRead();
      })
      .catch(() => {});
  }, [conversation.id]);

  // First load
  useEffect(() => {
    let active = true;
    listMessages(conversation.id)
      .then((data) => {
        if (!active) return;
        scrollIntent.current = { type: "bottom" };
        setMessages(data.messages);
        setHasMore(data.hasMore);
        markRead();
      })
      .catch((err) => active && setError({ type: "error", text: errorText(err) }));
    return () => {
      active = false;
    };
  }, [conversation.id, markRead]);

  // New messages: poll for ones after the newest we have (paused while the tab is
  // hidden, so messages aren't marked read when nobody's looking)
  useEffect(() => {
    if (messages === null) return;
    return pollWhileVisible(async () => {
      const newest = [...messages].reverse().find((m) => !m.pending);
      try {
        const data = await listMessages(conversation.id, newest ? { after: newest.id } : {});
        const fresh = data.messages.filter((m) => !messages.some((shown) => shown.id === m.id));
        if (fresh.length === 0) return;
        if (nearBottom()) scrollIntent.current = { type: "bottom" };
        setMessages((prev) => [...(prev ?? []), ...fresh]);
        const last = fresh[fresh.length - 1];
        onActivityRef.current({ lastMessage: last, updated: last.created });
        if (fresh.some((m) => m.senderId !== me.id)) markRead();
      } catch {
        // Try again on the next tick
      }
    }, POLL_THREAD_MS);
  }, [messages, conversation.id, me.id, markRead]);

  // Apply the scroll intent after the messages render
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const intent = scrollIntent.current;
    if (!el || !intent) return;
    if (intent.type === "bottom") el.scrollTop = el.scrollHeight;
    else el.scrollTop = el.scrollHeight - intent.fromBottom;
    scrollIntent.current = null;
  }, [messages]);

  async function loadOlder() {
    const oldest = messages?.find((m) => !m.pending);
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await listMessages(conversation.id, { before: oldest.id });
      const el = scrollRef.current;
      scrollIntent.current = { type: "keep", fromBottom: el ? el.scrollHeight - el.scrollTop : 0 };
      setMessages((prev) => [...data.messages, ...(prev ?? [])]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    } finally {
      setLoadingOlder(false);
    }
  }

  // Shows the message straight away, then swaps in the saved one (or marks it failed)
  async function send(body: string, retryOf?: ShownMessage) {
    const temp: ShownMessage = retryOf
      ? { ...retryOf, pending: "sending" }
      : { id: -Date.now(), conversationId: conversation.id, senderId: me.id, body, created: new Date().toISOString(), pending: "sending" };
    scrollIntent.current = { type: "bottom" };
    setMessages((prev) => (retryOf ? (prev ?? []).map((m) => (m.id === temp.id ? temp : m)) : [...(prev ?? []), temp]));
    try {
      const saved = await sendMessage(conversation.id, body);
      setMessages((prev) => {
        const list = prev ?? [];
        // The poll may already have added it
        return list.some((m) => m.id === saved.id) ? list.filter((m) => m.id !== temp.id) : list.map((m) => (m.id === temp.id ? saved : m));
      });
      onActivityRef.current({ lastMessage: saved, updated: saved.created });
      setError(null);
    } catch (err) {
      setMessages((prev) => (prev ?? []).map((m) => (m.id === temp.id ? { ...m, pending: "failed" } : m)));
      setError({ type: "error", text: errorText(err) });
    }
  }

  return (
    <>
      <header className="thread-header">
        <button type="button" className="icon-btn thread-back" onClick={onBack} aria-label="Back to conversations">
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>
        <a className="thread-user" href={`/profile?id=${otherUser.id}`}>
          <Avatar src={otherUser.profilePic} size={36} />
          <span className="thread-user-name">{otherUser.username}</span>
        </a>
      </header>

      <div className="thread-scroll" ref={scrollRef}>
        {messages === null ? (
          !error && <span className="loader" role="status" aria-label="Loading messages"></span>
        ) : (
          <>
            {hasMore && (
              <button type="button" className="link-btn thread-older" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            )}

            {!hasMore && (
              <div className="thread-start">
                <Avatar src={otherUser.profilePic} size={64} />
                <p>
                  This is the start of your conversation with <strong>{otherUser.username}</strong>.
                </p>
              </div>
            )}

            <ol className="message-list" aria-live="polite">
              {messages.map((message, i) => {
                const previous = messages[i - 1];
                const next = messages[i + 1];
                const newDay = !previous || !sameDay(previous.created, message.created);
                // Consecutive messages from the same person (same day) are grouped
                const firstInGroup = newDay || previous.senderId !== message.senderId;
                const lastInGroup = !next || next.senderId !== message.senderId || !sameDay(next.created, message.created);
                return (
                  <MessageItem
                    key={message.id}
                    message={message}
                    mine={message.senderId === me.id}
                    sender={message.senderId === me.id ? null : otherUser}
                    dayLabel={newDay ? formatDate(message.created) : null}
                    firstInGroup={firstInGroup}
                    lastInGroup={lastInGroup}
                    onRetry={() => send(message.body, message)}
                  />
                );
              })}
            </ol>
          </>
        )}
      </div>

      <Status status={error} />
      <Composer onSend={(body) => send(body)} recipient={otherUser.username} />
    </>
  );
}


interface MessageItemProps {
  message: ShownMessage;
  mine: boolean;
  sender: DmUser | null;
  dayLabel: string | null;
  firstInGroup: boolean;
  lastInGroup: boolean;
  onRetry: () => void;
}

function MessageItem({ message, mine, sender, dayLabel, firstInGroup, lastInGroup, onRetry }: MessageItemProps) {
  return (
    <>
      {dayLabel && (
        <li className="message-day" aria-hidden="true">
          <span>{dayLabel}</span>
        </li>
      )}
      <li
        className={`message${mine ? " is-mine" : ""}${firstInGroup ? " is-first" : ""}${lastInGroup ? " is-last" : ""}${message.pending ? ` is-${message.pending}` : ""}`}
      >
        {/* Their picture on the last message of each group */}
        {!mine && <span className="message-avatar">{lastInGroup && sender && <Avatar src={sender.profilePic} size={28} />}</span>}
        <div className="message-content">
          <div className="message-bubble" title={new Date(message.created).toLocaleString()}>
            <MentionText text={message.body} />
          </div>
          {lastInGroup && (
            <span className="message-meta">
              {message.pending === "sending" ? (
                "Sending…"
              ) : message.pending === "failed" ? (
                <>
                  <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> Not sent ·{" "}
                  <button type="button" className="link-btn" onClick={onRetry}>Try again</button>
                </>
              ) : (
                clockTime(message.created)
              )}
            </span>
          )}
        </div>
      </li>
    </>
  );
}


// Message box: Enter sends, Shift+Enter adds a new line, grows up to a few lines
function Composer({ onSend, recipient }: { onSend: (body: string) => void; recipient: string }) {
  const [text, setText] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text (up to the max-height in CSS)
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSend(body);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  const nearLimit = text.length > MAX_MESSAGE_LENGTH - 200;

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        ref={boxRef}
        className="textarea composer-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={`Message ${recipient}`}
        aria-label={`Message ${recipient}`}
        maxLength={MAX_MESSAGE_LENGTH}
        rows={1}
      />
      {nearLimit && <span className="hint composer-count">{MAX_MESSAGE_LENGTH - text.length}</span>}
      <button type="submit" className="btn btn-primary composer-send" disabled={!text.trim()} aria-label="Send">
        <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
      </button>
    </form>
  );
}


// "New message": search people by name, pick one to open (or start) the conversation
function NewMessageModal({ me, onClose, onPick }: { me: CurrentUser; onClose: () => void; onPick: (c: Conversation) => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<DmUser[] | null>(null);
  const [error, setError] = useState<StatusMessage | null>(null);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Search as you type (people search uses the main /search endpoint)
  useEffect(() => {
    const text = query.trim();
    if (!text) {
      setUsers(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const data = await api(`/search?q=${encodeURIComponent(text)}`);
        if (active) setUsers((data.users ?? []).filter((u: DmUser) => u.id !== me.id));
      } catch (err) {
        if (active) setError({ type: "error", text: errorText(err) });
      }
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, me.id]);

  async function pick(user: DmUser) {
    setOpening(user.id);
    try {
      onPick(await openConversation(user.id));
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
      setOpening(null);
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal members-modal" role="dialog" aria-modal="true" aria-labelledby="new-message-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="new-message-title" className="modal-title">New message</h2>
            <p className="modal-subtitle">Who do you want to talk to?</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <SearchBox value={query} onChange={setQuery} label="Search people" autoFocus className="modal-search" />
        <Status status={error} />

        <div className="member-list">
          {users === null ? (
            <p className="members-empty">Type a name to find someone.</p>
          ) : users.length === 0 ? (
            <p className="members-empty">Nobody matches “{query.trim()}”.</p>
          ) : (
            <ul>
              {users.map((user) => (
                <li key={user.id} className="member-row">
                  <button type="button" className="member new-message-user" onClick={() => pick(user)} disabled={opening !== null}>
                    <Avatar src={user.profilePic} size={36} />
                    <span className="member-info">
                      <span className="member-name">{user.username}</span>
                    </span>
                    {opening === user.id && <span className="hint">Opening…</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
