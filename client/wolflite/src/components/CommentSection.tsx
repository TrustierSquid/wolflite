import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import Avatar from "./Avatar";
import DropdownMenu from "./DropdownMenu";
import type { MenuItem } from "./DropdownMenu";
import Status from "./Status";
import { api } from "../lib/api";
import { loginHref, signupHref } from "../lib/auth";
import { timeAgo } from "../lib/time";

const MAX_COMMENT_LENGTH = 500; // same limit as the server

export interface Comment {
  id: number;
  author_id: number;
  author_username: string;
  profilePic: string | null;
  commentBody: string;
  created: string;
  /** When it was last edited, or null if never */
  edited: string | null;
  /** Set on replies: the top-level comment of the thread */
  parent_id: number | null;
}

/** The post or poll the comments belong to */
interface CommentTarget {
  id: number;
  author_id: number;
  isPoll: boolean;
  comments?: Comment[];
}

interface CurrentUser {
  id: number;
  profilePic: string | null;
}

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

// Posts a new comment, or a reply when parentId is given
function postComment(target: CommentTarget, commentBody: string, parentId?: number) {
  return api("/post/postComment", {
    method: "POST",
    json: { commentBody, postID: target.id, isPoll: target.isPoll, parentID: parentId },
  });
}


interface CommentSectionProps {
  item: CommentTarget;
  /** null for guests, undefined while loading */
  currentUser: CurrentUser | null | undefined;
  /** Reloads the page's data after any change */
  onChange?: () => unknown;
}

/*
  Comment form + threads for a post or poll.
  Threads are newest first; replies inside a thread are oldest first (reads like
  a conversation). Replies are one level deep and collapsed until opened.
*/
export default function CommentSection({ item, currentUser, onChange }: CommentSectionProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<StatusMessage | null>(null);

  const all = item.comments ?? [];
  const threads = all.filter((c) => c.parent_id === null).sort((a, b) => b.id - a.id);
  const repliesFor = (parentId: number) =>
    all.filter((c) => c.parent_id === parentId).sort((a, b) => a.id - b.id);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const commentBody = text.trim();
    if (!commentBody || sending) return;

    setSending(true);
    setError(null);
    try {
      await postComment(item, commentBody);
      setText("");
      await onChange?.();
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comments">
      {currentUser === null ? (
        <p className="comments-login">
          <i className="fa-regular fa-comment" aria-hidden="true"></i>
          <span>
            <a href={loginHref()}>Log in</a> or <a href={signupHref()}>create an account</a> to comment.
          </span>
        </p>
      ) : (
      <form className="comment-form" onSubmit={submit}>
        <Avatar src={currentUser?.profilePic} size={32} />
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          aria-label="Write a comment"
          maxLength={MAX_COMMENT_LENGTH}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Post
        </button>
      </form>
      )}

      <Status status={error} />

      {threads.length > 0 ? (
        <ul className="comment-list">
          {threads.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              replies={repliesFor(comment.id)}
              target={item}
              currentUser={currentUser}
              onChange={onChange}
            />
          ))}
        </ul>
      ) : (
        <p className="comments-empty">No comments yet. Be the first!</p>
      )}
    </div>
  );
}


interface CommentThreadProps {
  comment: Comment;
  replies: Comment[];
  target: CommentTarget;
  currentUser: CurrentUser | null | undefined;
  onChange?: () => unknown;
}

// A top-level comment, its (collapsible) replies, and the reply box
function CommentThread({ comment, replies, target, currentUser, onChange }: CommentThreadProps) {
  const [expanded, setExpanded] = useState(false);
  // null = reply box closed; otherwise the text it opens with ("" or "@name ")
  const [replyStart, setReplyStart] = useState<string | null>(null);
  const repliesId = useId();

  function openReply(to: Comment) {
    // Replying to a reply mentions its author, since replies are one level deep
    setReplyStart(to.id === comment.id ? "" : `@${to.author_username} `);
    setExpanded(true);
  }

  const itemProps = { postAuthorId: target.author_id, currentUserId: currentUser?.id, onChange };

  return (
    <li className="comment-thread">
      <CommentItem comment={comment} replyCount={replies.length} onReply={() => openReply(comment)} {...itemProps} />

      {replies.length > 0 && (
        <button
          type="button"
          className="replies-toggle"
          aria-expanded={expanded}
          aria-controls={repliesId}
          onClick={() => setExpanded((open) => !open)}
        >
          <i className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`} aria-hidden="true"></i>
          {expanded ? "Hide replies" : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </button>
      )}

      {expanded && replies.length > 0 && (
        <ul className="comment-replies" id={repliesId}>
          {replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem comment={reply} isReply onReply={() => openReply(reply)} {...itemProps} />
            </li>
          ))}
        </ul>
      )}

      {replyStart !== null && (
        <ReplyForm
          key={replyStart}
          target={target}
          parentId={comment.id}
          initialText={replyStart}
          currentUser={currentUser}
          onDone={async (posted) => {
            setReplyStart(null);
            if (posted) {
              setExpanded(true);
              await onChange?.();
            }
          }}
        />
      )}
    </li>
  );
}


interface ReplyFormProps {
  target: CommentTarget;
  parentId: number;
  initialText: string;
  currentUser: CurrentUser | null | undefined;
  /** Called when the form closes; posted = a reply was sent */
  onDone: (posted: boolean) => unknown;
}

function ReplyForm({ target, parentId, initialText, currentUser, onDone }: ReplyFormProps) {
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<StatusMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus with the cursor after any "@name " that was filled in
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const commentBody = text.trim();
    if (!commentBody || sending) return;

    setSending(true);
    setError(null);
    try {
      await postComment(target, commentBody, parentId);
      await onDone(true);
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
      setSending(false);
    }
  }

  return (
    <div className="reply-form-wrap">
      <form className="comment-form reply-form" onSubmit={submit}>
        <Avatar src={currentUser?.profilePic} size={28} />
        <input
          ref={inputRef}
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onDone(false);
          }}
          placeholder="Write a reply…"
          aria-label="Write a reply"
          maxLength={MAX_COMMENT_LENGTH}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDone(false)} disabled={sending}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
          Reply
        </button>
      </form>
      <Status status={error} />
    </div>
  );
}


interface CommentItemProps {
  comment: Comment;
  /** Author of the post / poll this comment is on */
  postAuthorId: number;
  /** Logged in user (undefined while loading) */
  currentUserId?: number;
  /** Reloads the page's data after an edit or delete */
  onChange?: () => unknown;
  /** Opens the reply box for this comment's thread */
  onReply: () => void;
  /** Replies are drawn a little smaller */
  isReply?: boolean;
  /** Number of replies (top-level comments only), for the delete warning */
  replyCount?: number;
}

/*
  One comment or reply.
  - Its writer can edit or delete it (⋮ menu)
  - The post's author can delete it (moderating their own post), but not edit it
  - Comments by the post's author get the yellow "Author" badge
  The server enforces the same rules.
*/
function CommentItem({ comment, postAuthorId, currentUserId, onChange, onReply, isReply = false, replyCount = 0 }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.commentBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StatusMessage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isMine = currentUserId !== undefined && comment.author_id === currentUserId;
  const onMyPost = currentUserId !== undefined && postAuthorId === currentUserId;
  const byPostAuthor = comment.author_id === postAuthorId;

  // When editing starts, focus the box with the cursor at the end of the text
  useEffect(() => {
    const box = textareaRef.current;
    if (!editing || !box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }, [editing]);

  function startEditing() {
    setDraft(comment.commentBody);
    setError(null);
    setEditing(true);
  }

  async function save(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    const commentBody = draft.trim();
    if (!commentBody || busy) return;
    if (commentBody === comment.commentBody) {
      setEditing(false); // nothing changed
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api(`/post/comment/${comment.id}`, { method: "PUT", json: { commentBody } });
      await onChange?.();
      setEditing(false);
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const what = isMine ? "your comment" : `${comment.author_username}'s comment`;
    const replies = replyCount > 0 ? ` Its ${replyCount} ${replyCount === 1 ? "reply" : "replies"} will be deleted too.` : "";
    if (!window.confirm(`Delete ${what}?${replies}`)) return;

    setBusy(true);
    setError(null);
    try {
      await api(`/post/comment/${comment.id}`, { method: "DELETE" });
      await onChange?.();
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
      setBusy(false);
    }
  }

  const menuItems: MenuItem[] = [];
  if (isMine) menuItems.push({ label: "Edit", icon: "fa-pen", onSelect: startEditing });
  if (isMine || onMyPost) menuItems.push({ label: "Delete", icon: "fa-trash", onSelect: remove, danger: true });

  return (
    <div className={`comment${isReply ? " is-reply" : ""}`}>
      <Avatar src={comment.profilePic} size={isReply ? 28 : 32} />
      <div className="comment-main">
        <div className="comment-bubble">
          <div className="comment-header">
            <div className="comment-meta">
              <a className="comment-author" href={`/profile?id=${comment.author_id}`}>
                {comment.author_username}
              </a>
              {byPostAuthor && (
                <span className="tag tag-author" title="Wrote this post">
                  <i className="fa-solid fa-pen-nib" aria-hidden="true"></i> Author
                </span>
              )}
            </div>
            <span className="comment-time">
              {timeAgo(comment.created)}
              {comment.edited && <span title={`Edited ${timeAgo(comment.edited)}`}> · edited</span>}
            </span>
            {!editing && <DropdownMenu items={menuItems} label="Comment options" size="small" />}
          </div>

          {editing ? (
            <form className="comment-edit" onSubmit={save}>
              <textarea
                ref={textareaRef}
                className="textarea comment-edit-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setEditing(false);
                  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    save(e);
                  }
                }}
                maxLength={MAX_COMMENT_LENGTH}
                rows={2}
                aria-label="Edit comment"
              />
              <div className="comment-edit-actions">
                <span className="hint">Ctrl+Enter to save · Esc to cancel</span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !draft.trim()}>
                  Save
                </button>
              </div>
            </form>
          ) : (
            <p className="comment-body">{comment.commentBody}</p>
          )}

          <Status status={error} />
        </div>

        {!editing && currentUserId !== undefined && (
          <button type="button" className="comment-reply-btn" onClick={onReply}>
            <i className="fa-solid fa-reply" aria-hidden="true"></i> Reply
          </button>
        )}
      </div>
    </div>
  );
}
