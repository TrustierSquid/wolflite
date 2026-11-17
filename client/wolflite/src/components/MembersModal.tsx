import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import DropdownMenu from "./DropdownMenu";
import type { MenuItem } from "./DropdownMenu";
import SearchBox from "./SearchBox";
import Status from "./Status";
import { listMembers, pluralize, removeMember, setMemberRole } from "../lib/dens";
import type { Den, DenMember } from "../lib/dens";
import { formatDate } from "../lib/time";

interface MembersModalProps {
  den: Den;
  /** The logged in user's id (undefined for guests), so they don't get actions on themselves */
  currentUserId?: number;
  onClose: () => void;
  /** Called with the updated den after someone is removed (member count changes) */
  onDenChange: (den: Den) => void;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

// Popup listing everyone in a den (owner, moderators, members), with a search box.
// Each member links to their profile. Owners and moderators get a ⋮ menu on
// each member they can manage:
//   owner      make / remove moderator, remove from den
//   moderator  remove regular members from den
// Closes with the X button, the Escape key, or a click outside the panel.
export default function MembersModal({ den, currentUserId, onClose, onDenChange }: MembersModalProps) {
  const [members, setMembers] = useState<DenMember[] | null>(null); // null while loading
  const [error, setError] = useState<{ type: "error"; text: string } | null>(null);
  const [query, setQuery] = useState("");

  const denId = den.id;
  const load = useCallback(async () => {
    try {
      setMembers(await listMembers({ id: denId }));
      setError(null);
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    }
  }, [denId]);

  useEffect(() => {
    load();
  }, [load]);

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

  // Search by username, ignoring case
  const search = query.trim().toLowerCase();
  const shown = members && (search ? members.filter((m) => m.username.toLowerCase().includes(search)) : members);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    }
  }

  function remove(member: DenMember) {
    if (!window.confirm(`Remove ${member.username} from ${den.name}? Their posts stay in the den, and they can join again.`)) return;
    run(async () => onDenChange(await removeMember(den, member.id)));
  }

  function changeRole(member: DenMember, role: "moderator" | "member") {
    run(() => setMemberRole(den, member.id, role));
  }

  // What the logged in user can do to this member (mirrors the server's rules)
  function actionsFor(member: DenMember): MenuItem[] {
    if (member.id === currentUserId || member.role === "owner") return [];
    const items: MenuItem[] = [];

    if (den.myRole === "owner") {
      items.push(
        member.role === "moderator"
          ? { label: "Remove moderator", icon: "fa-shield-halved", onSelect: () => changeRole(member, "member") }
          : { label: "Make moderator", icon: "fa-shield-halved", onSelect: () => changeRole(member, "moderator") }
      );
    }
    if (den.myRole === "owner" || (den.myRole === "moderator" && member.role === "member")) {
      items.push({ label: "Remove from den", icon: "fa-user-minus", onSelect: () => remove(member), danger: true });
    }
    return items;
  }

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

        <SearchBox value={query} onChange={setQuery} label="Search members" autoFocus className="modal-search" />

        <div className="member-list">
          <Status status={error} />
          {shown === null ? (
            !error && <span className="loader" role="status" aria-label="Loading members"></span>
          ) : shown.length === 0 ? (
            <p className="members-empty">No members match “{query.trim()}”.</p>
          ) : (
            <ul>
              {shown.map((member) => (
                <li key={member.id} className="member-row">
                  <a className="member" href={`/profile?id=${member.id}`}>
                    <Avatar src={member.profilePic} size={36} />
                    <span className="member-info">
                      <span className="member-name">{member.username}</span>
                      <span className="member-joined">
                        {member.role === "owner" ? "Created the den" : "Joined"} {formatDate(member.joined)}
                      </span>
                    </span>
                    <RoleTag role={member.role} />
                  </a>
                  <DropdownMenu items={actionsFor(member)} label={`Options for ${member.username}`} size="small" />
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


// Owner: yellow crown. Moderator: purple shield. Members: no badge.
export function RoleTag({ role }: { role: DenMember["role"] | null }) {
  if (role === "owner") {
    return (
      <span className="tag tag-owner">
        <i className="fa-solid fa-crown" aria-hidden="true"></i> Owner
      </span>
    );
  }
  if (role === "moderator") {
    return (
      <span className="tag tag-moderator">
        <i className="fa-solid fa-shield-halved" aria-hidden="true"></i> Moderator
      </span>
    );
  }
  return null;
}
