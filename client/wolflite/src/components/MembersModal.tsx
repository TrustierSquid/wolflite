import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import Status from "./Status";
import { listMembers, pluralize } from "../lib/dens";
import type { Den, DenMember } from "../lib/dens";
import { formatDate } from "../lib/time";

interface MembersModalProps {
  den: Den;
  onClose: () => void;
}

// Popup listing everyone in a den (owner first). Each member links to their profile.
// Closes with the X button, the Escape key, or a click outside the panel.
export default function MembersModal({ den, onClose }: MembersModalProps) {
  const [members, setMembers] = useState<DenMember[] | null>(null); // null while loading
  const [error, setError] = useState<{ type: "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");

  // Search by username, ignoring case
  const search = query.trim().toLowerCase();
  const shown = members && (search ? members.filter((m) => m.username.toLowerCase().includes(search)) : members);

  useEffect(() => {
    listMembers(den)
      .then(setMembers)
      .catch((err) => setError({ type: "error", text: err instanceof Error ? err.message : "Couldn't load members" }));
  }, [den]);

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

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="card modal members-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="members-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="members-title" className="modal-title">Members of {den.name}</h2>
            <p className="modal-subtitle" aria-live="polite">
              {search && shown
                ? `${shown.length} of ${pluralize(members!.length, "member")}`
                : pluralize(members?.length ?? den.memberCount, "member")}
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="member-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
          <input
            type="search"
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members"
            aria-label="Search members"
            autoFocus
          />
          {query && (
            <button type="button" className="icon-btn member-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          )}
        </div>

        <div className="member-list">
          <Status status={error} />
          {shown === null ? (
            !error && <span className="loader" role="status" aria-label="Loading members"></span>
          ) : shown.length === 0 ? (
            <p className="members-empty">No members match “{query.trim()}”.</p>
          ) : (
            <ul>
              {shown.map((member) => (
                <li key={member.id}>
                  <a className="member" href={`/profile?id=${member.id}`}>
                    <Avatar src={member.profilePic} size={36} />
                    <span className="member-info">
                      <span className="member-name">{member.username}</span>
                      <span className="member-joined">
                        {member.role === "owner" ? "Created the den" : "Joined"} {formatDate(member.joined)}
                      </span>
                    </span>
                    {member.role === "owner" && (
                      <span className="tag tag-owner">
                        <i className="fa-solid fa-crown" aria-hidden="true"></i> Owner
                      </span>
                    )}
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
