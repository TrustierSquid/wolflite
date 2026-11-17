# Direct messages API

The `/messages` page (client: `src/pages/MessagesPage.tsx`, API calls in `src/lib/messages.ts`)
expects the endpoints below. They are prefixed with `/dm` so they don't clash with the
`/messages` page itself (Vite already proxies `/dm` to Flask).

Everything here needs a logged in user: don't add these endpoints to `PUBLIC_ENDPOINTS`,
so the middleware answers guests with a 401 and `g.user` is always set. As everywhere else,
take the user's id from `g.user["id"]`, never from the request.

Dates can be anything JavaScript's `new Date(...)` reads. Flask's default (`"Tue, 17 Nov 2026 04:27:11 GMT"`) works.

## Shapes

```jsonc
// DmUser
{ "id": 5, "username": "bobby_k", "profilePic": "/static/uploads/....png" }  // profilePic may be null

// Message
{ "id": 42, "conversationId": 7, "senderId": 5, "body": "hey!", "created": "<date>" }

// Conversation (always from the logged in user's point of view)
{
  "id": 7,
  "otherUser": DmUser,           // the person you're talking to
  "lastMessage": Message | null, // null for a conversation with no messages yet
  "unreadCount": 2,              // messages from otherUser you haven't read
  "updated": "<date>"            // last message's time, or when the conversation was created
}
```

## Endpoints

### `GET /dm/conversations`
Your conversations, most recently active first.
```json
{ "conversations": [Conversation, ...], "unreadTotal": 3 }
```
`unreadTotal` is the sum of `unreadCount`s. It drives the badge on **Messages** in the side nav,
which polls this every 30 seconds.

### `POST /dm/conversations`
Body: `{ "userId": 5 }`. Returns the conversation between you and that user, **creating it
if it doesn't exist** (get-or-create, so there's only ever one per pair).
```json
{ "conversation": Conversation }
```
Errors: `400` messaging yourself, `404` user doesn't exist.

### `GET /dm/conversations/<id>/messages`
Messages in the conversation, **oldest first**.

| Query | Meaning |
| --- | --- |
| (none) | the newest 50 |
| `?before=<messageId>` | the 50 just before that message ("Load earlier messages") |
| `?after=<messageId>` | everything after that message (the page polls this every 4 s while a conversation is open) |

```json
{ "messages": [Message, ...], "hasMore": true }
```
`hasMore`: are there older messages than the first one returned. The page shows
"Load earlier messages" when true, and "This is the start of your conversation" when false.
For `after` requests it's ignored.

Errors: `404` conversation doesn't exist **or you're not in it** (use 404 for both, so ids can't be probed).

### `POST /dm/conversations/<id>/messages`
Body: `{ "body": "text" }`. Trim it; reject empty (`400`) and longer than **2000** characters (`400`).
```json
{ "message": Message }
```
Also a good place to call `notify(other_user_id, "dm", actor_id=g.user["id"], snippet=make_snippet(body))`.
The notification panel already shows `dm` notifications ("X sent you a message") and links them to the conversation.
You may want to skip it when they already have unread messages from you, so a burst of messages doesn't create a burst of notifications.

### `PUT /dm/conversations/<id>/read`
Marks everything in the conversation as read for you. Called when you open a conversation and
when new messages arrive while it's open.
```json
{ "success": true }
```

## Tables

Already in `server/wolfr/schema.sql` (and created on existing databases by `upgrade_db()` in `db.py`):

| Table | Columns |
| --- | --- |
| `conversations` | `id`, `created`, `updated` (set it to the newest message's time on every send) |
| `conversation_members` | `conversation_id`, `user_id` (primary key together), `last_read_message_id`, `joined` |
| `direct_messages` | `id`, `conversation_id`, `sender_id`, `body`, `created` |

Useful queries:

```sql
-- The conversation between you and another user (for get-or-create)
SELECT a.conversation_id FROM conversation_members a
JOIN conversation_members b ON b.conversation_id = a.conversation_id
WHERE a.user_id = :me AND b.user_id = :other;

-- Your unread count in a conversation
SELECT COUNT(*) FROM direct_messages m
JOIN conversation_members cm ON cm.conversation_id = m.conversation_id AND cm.user_id = :me
WHERE m.conversation_id = :conversation AND m.sender_id != :me
  AND m.id > COALESCE(cm.last_read_message_id, 0);

-- Newest 50 messages, oldest first (add AND id < :before for older pages)
SELECT * FROM (
  SELECT * FROM direct_messages WHERE conversation_id = :conversation ORDER BY id DESC LIMIT 51
) ORDER BY id;   -- 51 so you know hasMore; drop the extra one before returning
```

When deleting an account (`deleteProfile`), remove the user's `conversation_members` rows
(and decide whether their messages stay for the other person or are deleted too).

## Later: WebSockets
The page polls (`POLL_THREAD_MS` in `lib/messages.ts`). When the server can push new messages,
append them in `Thread` (`MessagesPage.tsx`) the same way the poll does, and keep the poll as a
slow fallback for when the socket drops.
