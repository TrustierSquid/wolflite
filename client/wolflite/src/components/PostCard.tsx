import { useState } from "react";
import Avatar from "./Avatar";
import CommentSection from "./CommentSection";
import DropdownMenu from "./DropdownMenu";
import type { MenuItem } from "./DropdownMenu";
import Status from "./Status";
import { api } from "../lib/api";
import { timeAgo } from "../lib/time";

const VIDEO_FILE = /\.(mp4|mov|webm|avi)$/i;

/*
  One card for both posts and polls, used by the feed and the profile page.

  item          a post or poll from the API (item.isPoll tells which)
  currentUser   the logged in user ({ id, username, profilePic, ... }) or null while loading
  onChange      called after a like / vote / comment / close, so the page can reload its data
  onShowVoters  called with the poll when "N votes" is clicked
*/
export default function PostCard({ item, currentUser, onChange, onShowVoters }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const [error, setError] = useState(null);

  const currentUserId = currentUser?.id;
  const isOwner = currentUserId !== undefined && item.author_id === currentUserId;
  const kind = item.isPoll ? "poll" : "post";
  const likes = (item.isPoll ? item.likesByPoll : item.likesByPost) ?? [];
  const isLiked = likes.some((like) => like.author_id === currentUserId);
  const commentCount = item.comments?.length ?? 0;

  // Runs an API call, then asks the page to reload. Ignores clicks while one is in flight.
  async function run(request) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await request();
      await onChange?.();
    } catch (err) {
      setError({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  function toggleLike() {
    setLikePop(true);
    run(() => api(`/post/addLike/${item.id}/${item.isPoll}`, { method: "POST" }));
  }

  function vote(optionId) {
    run(() => api("/post/poll/userStats", { method: "POST", json: { pollID: item.id, optionID: optionId } }));
  }

  function closePoll() {
    if (!window.confirm("Close this poll? Nobody will be able to vote anymore.")) return;
    run(() => api(`/profileInfo/closePoll/${item.id}`, { method: "DELETE" }));
  }

  function toggleArchive() {
    run(() =>
      api(`/post/archive/${item.id}/${item.isPoll}`, { method: "PUT", json: { archived: !item.isArchived } })
    );
  }

  function deleteItem() {
    if (!window.confirm(`Delete this ${kind}? This can't be undone.`)) return;
    run(() => api(`/post/delete/${item.id}/${item.isPoll}`, { method: "DELETE" }));
  }

  // Options in the ⋮ menu. Add future options here; the menu hides itself when the list is empty.
  const menuItems: MenuItem[] = [];
  if (isOwner) {
    menuItems.push(
      item.isArchived
        ? { label: "Unarchive", icon: "fa-box-open", onSelect: toggleArchive }
        : { label: "Archive", icon: "fa-box-archive", onSelect: toggleArchive },
      { label: "Delete", icon: "fa-trash", onSelect: deleteItem, danger: true }
    );
  }

  return (
    <article className="card post">
      <header className="post-header">
        <Avatar src={item.profilePic} size={40} />
        <div className="post-meta">
          <a className="post-author" href={`/profile?id=${item.author_id}`}>
            {item.username}
          </a>
          <time className="post-time" dateTime={new Date(item.created).toISOString()}>
            {timeAgo(item.created)}
          </time>
        </div>
        {item.isArchived && (
          <span className="tag">
            <i className="fa-solid fa-box-archive" aria-hidden="true"></i> Archived
          </span>
        )}
        <DropdownMenu items={menuItems} label={`${kind === "poll" ? "Poll" : "Post"} options`} />
      </header>

      {item.isPoll ? (
        <PollBody
          poll={item}
          isOwner={isOwner}
          currentUserId={currentUserId}
          busy={busy}
          onVote={vote}
          onClose={closePoll}
          onShowVoters={onShowVoters}
        />
      ) : (
        <PostBody post={item} />
      )}

      <Status status={error} />

      <div className="post-actions">
        <button
          type="button"
          className={`action-btn${isLiked ? " is-active" : ""}`}
          onClick={toggleLike}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike" : "Like"}
        >
          <i
            className={`${isLiked ? "fa-solid" : "fa-regular"} fa-heart${likePop ? " pop" : ""}`}
            onAnimationEnd={() => setLikePop(false)}
            aria-hidden="true"
          ></i>
          {item.likeCount ?? 0}
        </button>

        <button
          type="button"
          className={`action-btn${commentsOpen ? " is-active" : ""}`}
          onClick={() => setCommentsOpen((open) => !open)}
          aria-expanded={commentsOpen}
        >
          <i className="fa-regular fa-comment" aria-hidden="true"></i>
          {commentCount} {commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>

      {commentsOpen && <CommentSection item={item} currentUser={currentUser} onChange={onChange} />}
    </article>
  );
}


function PostBody({ post }) {
  // The feed sends the media path as "filename", the profile page as "postPic"
  const media = post.filename ?? post.postPic;

  return (
    <>
      <h2 className="post-title">{post.title}</h2>
      {post.body && <p className="post-body">{post.body}</p>}
      {media &&
        (VIDEO_FILE.test(media) ? (
          <video className="post-media" src={media} controls preload="metadata" />
        ) : (
          <img className="post-media" src={media} alt="" loading="lazy" />
        ))}
    </>
  );
}


function PollBody({ poll, isOwner, currentUserId, busy, onVote, onClose, onShowVoters }) {
  const total = poll.totalVotes || 0;

  return (
    <>
      <h2 className="poll-question">{poll.question}</h2>

      <div className="poll-options">
        {poll.options?.map((option) => {
          const percent = total ? Math.round((option.user_voted / total) * 100) : 0;
          const voted = option.voters?.includes(currentUserId);

          return (
            <button
              key={option.id}
              type="button"
              className={`poll-option${voted ? " is-voted" : ""}`}
              disabled={!poll.isOpen || busy}
              onClick={() => onVote(option.id)}
              aria-pressed={voted}
            >
              <span className="poll-option-fill" style={{ width: `${percent}%` }}></span>
              <span className="poll-option-text">
                {voted && <i className="fa-solid fa-circle-check" aria-hidden="true"></i>}
                {option.option_text}
              </span>
              <span className="poll-option-stats">
                {option.user_voted} · {percent}%
              </span>
            </button>
          );
        })}
      </div>

      <div className="poll-footer">
        <button type="button" className="link-btn" onClick={() => onShowVoters?.(poll)}>
          {total} {total === 1 ? "vote" : "votes"}
        </button>

        {!poll.isOpen && (
          <span className="tag">
            <i className="fa-solid fa-lock" aria-hidden="true"></i> Closed
          </span>
        )}

        {poll.isOpen && isOwner && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i> Close poll
          </button>
        )}
      </div>
    </>
  );
}
