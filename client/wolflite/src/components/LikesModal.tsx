import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import SearchBox from "./SearchBox";
import { matchesSearch } from "../lib/search";
import { pluralize } from "../lib/dens";
import { timeAgo } from "../lib/time";

/** One like, as the feed sends it (item.likesByPost / item.likesByPoll) */
export interface Like {
  author_id: number;
  username: string;
  profilePic?: string | null;
  created?: string;
}

interface LikesModalProps {
  /** Shown under the title: the post's title or the poll's question */
  title: string;
  likes: Like[];
  onClose: () => void;
}

// "Liked by" popup for a post or poll, newest likes first, with a search box.
// Closes with the X button, the Escape key, or a click outside the panel.
export default function LikesModal({ title, likes, onClose }: LikesModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the popup from scrolling
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const sorted = [...likes].sort((a, b) => new Date(b.created ?? 0).getTime() - new Date(a.created ?? 0).getTime());
  const shown = sorted.filter((like) => matchesSearch(like.username, query));

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal members-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="likes-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="likes-heading">
            <h2 id="likes-title" className="modal-title">
              <i className="fa-solid fa-heart likes-heart" aria-hidden="true"></i> Liked by
            </h2>
            <p className="modal-subtitle likes-subtitle" aria-live="polite">
              {query.trim() ? `${shown.length} of ${pluralize(likes.length, "like")}` : pluralize(likes.length, "like")} · {title}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        {likes.length > 0 && (
          <SearchBox value={query} onChange={setQuery} label="Search likes" autoFocus className="modal-search" />
        )}

        <div className="member-list">
          {likes.length === 0 ? (
            <p className="members-empty">No likes yet.</p>
          ) : shown.length === 0 ? (
            <p className="members-empty">Nobody matching “{query.trim()}” liked this.</p>
          ) : (
            <ul>
              {shown.map((like) => (
                <li key={like.author_id} className="member-row">
                  <a className="member" href={`/profile?id=${like.author_id}`}>
                    <Avatar src={like.profilePic} size={36} />
                    <span className="member-info">
                      <span className="member-name">{like.username}</span>
                      {like.created && <span className="member-joined">Liked {timeAgo(like.created)}</span>}
                    </span>
                  </a>
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
