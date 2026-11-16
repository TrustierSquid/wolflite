import { useState } from "react";
import Avatar from "./Avatar";
import Status from "./Status";
import { api } from "../lib/api";
import { timeAgo } from "../lib/time";

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
          maxLength={500}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> Post
        </button>
      </form>

      <Status status={error} />

      {comments.length > 0 ? (
        <ul className="comment-list">
          {comments.map((comment, index) => (
            <li className="comment" key={`${comment.author_id}-${comment.created}-${index}`}>
              <Avatar src={comment.profilePic} size={32} />
              <div className="comment-bubble">
                <div className="comment-header">
                  <a className="comment-author" href={`/profile?id=${comment.author_id}`}>
                    {comment.author_username}
                  </a>
                  <span className="comment-time">{timeAgo(comment.created)}</span>
                </div>
                <p className="comment-body">{comment.commentBody}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="comments-empty">No comments yet. Be the first!</p>
      )}
    </div>
  );
}
