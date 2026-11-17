import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import DropdownMenu from "./DropdownMenu";
import type { MenuItem } from "./DropdownMenu";
import Status from "./Status";
import { api } from "../lib/api";
import { timeAgo } from "../lib/time";

const MAX_COMMENT_LENGTH = 500; // same limit as the server

// Comment form + list (newest first) for a post or poll
export default function CommentSection({ item, currentUser, onChange }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const comments = [...(item.comments ?? [])].reverse();

  async function submit(e) {
    e.preventDefault();
    const commentBody = text.trim();
    if (!commentBody || sending) return;

    setSending(true);
    setError(null);
    try {
      await api("/post/postComment", {
        method: "POST",
        json: { commentBody, postID: item.id, isPoll: item.isPoll },
      });
      setText("");
      await onChange?.();
    } catch (err) {
      setError({ type: "error", text: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="comments">
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

      <Status status={error} />

      {comments.length > 0 ? (
        <ul className="comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postAuthorId={item.author_id}
              currentUserId={currentUser?.id}
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


export interface Comment {
  id: number;
  author_id: number;
  author_username: string;
  profilePic: string | null;
  commentBody: string;
  created: string;
  /** When it was last edited, or null if never */
  edited: string | null;
}

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

interface CommentItemProps {
  comment: Comment;
  /** Author of the post / poll this comment is on */
  postAuthorId: number;
  /** Logged in user (undefined while loading) */
  currentUserId?: number;
  /** Reloads the page's data after an edit or delete */
  onChange?: () => unknown;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

/*
  One comment.
  - Its writer can edit or delete it (⋮ menu)
  - The post's author can delete it (moderating their own post), but not edit it
  - Comments by the post's author get the yellow "Author" badge
  The server enforces the same rules.
*/
function CommentItem({ comment, postAuthorId, currentUserId, onChange }: CommentItemProps) {
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
    const question = isMine ? "Delete your comment?" : `Delete ${comment.author_username}'s comment from your post?`;
    if (!window.confirm(question)) return;

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
    <li className="comment">
      <Avatar src={comment.profilePic} size={32} />
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
    </li>
  );
}
