import { useState } from "react";
import DenAvatar from "./DenAvatar";
import { isLoginRequired } from "../lib/auth";
import { denHref, pluralize, setMembership } from "../lib/dens";
import type { Den } from "../lib/dens";

interface JoinButtonProps {
  den: Den;
  /** Called with the updated den after joining / leaving */
  onChange: (den: Den) => void;
  small?: boolean;
}

// Join / leave a den. Owners can't leave, so they get an "Owner" badge instead.
// Guests clicking Join get the login prompt (the server answers 401).
export function JoinButton({ den, onChange, small = false }: JoinButtonProps) {
  const [busy, setBusy] = useState(false);
  const size = small ? " btn-sm" : "";

  if (den.isOwner) {
    return (
      <span className="tag tag-owner">
        <i className="fa-solid fa-crown" aria-hidden="true"></i> Owner
      </span>
    );
  }

  async function toggle() {
    if (den.isMember && !window.confirm(`Leave ${den.name}? Its posts will no longer be in your Home feed.`)) return;
    setBusy(true);
    try {
      onChange(await setMembership(den, !den.isMember));
    } catch (err) {
      if (!isLoginRequired(err)) window.alert(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return den.isMember ? (
    <button type="button" className={`btn btn-secondary${size}`} onClick={toggle} disabled={busy} title={`Leave ${den.name}`}>
      <i className="fa-solid fa-check" aria-hidden="true"></i> Joined
    </button>
  ) : (
    <button type="button" className={`btn btn-primary${size}`} onClick={toggle} disabled={busy}>
      <i className="fa-solid fa-plus" aria-hidden="true"></i> Join
    </button>
  );
}


interface DenCardProps {
  den: Den;
  onChange: (den: Den) => void;
}

// One den in a list: picture, name, description, counts and a Join button
export default function DenCard({ den, onChange }: DenCardProps) {
  return (
    <article className="card den-card">
      <a href={denHref(den.name)} className="den-card-link">
        <DenAvatar name={den.name} image={den.image} size={48} />
        <div className="den-card-info">
          <h3 className="den-card-name">{den.name}</h3>
          <p className="den-card-stats">
            {pluralize(den.memberCount, "member")} · {pluralize(den.postCount, "post")}
          </p>
          <p className="den-card-desc">{den.description}</p>
        </div>
      </a>
      <JoinButton den={den} onChange={onChange} small />
    </article>
  );
}
