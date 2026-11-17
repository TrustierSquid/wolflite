import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Avatar from "../components/Avatar";
import DenAvatar from "../components/DenAvatar";
import { JoinButton } from "../components/DenCard";
import MembersModal from "../components/MembersModal";
import PostCard from "../components/PostCard";
import Status from "../components/Status";
import VotersModal from "../components/VotersModal";
import { api } from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";
import { MAX_DEN_DESCRIPTION, getDen, pluralize } from "../lib/dens";
import type { Den } from "../lib/dens";
import type { FeedItem } from "../lib/feed";
import { formatDate } from "../lib/time";

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");

// /den?name=homelab  One den: its picture, description, members and posts
export default function DenPage() {
  const currentUser = useCurrentUser();
  const name = new URLSearchParams(window.location.search).get("name") ?? "";

  const [den, setDen] = useState<Den | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [error, setError] = useState<StatusMessage | null>(null);
  const [editing, setEditing] = useState(false);
  const [votersPoll, setVotersPoll] = useState(null);
  const [showMembers, setShowMembers] = useState(false);

  const loadDen = useCallback(async () => {
    if (!name) {
      setNotFound(true);
      return;
    }
    try {
      const loaded = await getDen(name);
      setDen(loaded);
      document.title = `Wolflite | ${loaded.name}`;
    } catch {
      setNotFound(true);
    }
  }, [name]);

  const loadFeed = useCallback(async () => {
    if (!name) return;
    try {
      const data = await api(`/post/fetch?den=${encodeURIComponent(name)}`);
      setFeed(data.feed ?? []);
      setError(null);
    } catch (err) {
      setError({ type: "error", text: errorText(err) });
    }
  }, [name]);

  useEffect(() => {
    loadDen();
    loadFeed();
  }, [loadDen, loadFeed]);

  const closeVoters = useCallback(() => setVotersPoll(null), []);
  const closeMembers = useCallback(() => setShowMembers(false), []);

  if (notFound) {
    return (
      <main className="page">
        <div className="empty-state">
          <i className="fa-solid fa-circle-question" aria-hidden="true"></i> This den doesn't exist.{" "}
          <a className="link-btn" href="/blog?tab=discover">Discover dens</a>
        </div>
      </main>
    );
  }

  if (!den) {
    return (
      <main className="page">
        <span className="loader" role="status" aria-label="Loading den"></span>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="card den-header">
        <DenAvatar name={den.name} image={den.image} size={80} />

        <div className="den-info">
          <h1 className="den-name">{den.name}</h1>
          <p className="den-stats">
            <button
              type="button"
              className="den-members-btn"
              onClick={() => setShowMembers(true)}
              aria-haspopup="dialog"
              title="See who's in this den"
            >
              <i className="fa-solid fa-users" aria-hidden="true"></i> {pluralize(den.memberCount, "member")}
            </button>{" "}
            · {pluralize(den.postCount, "post")}
          </p>

          {editing ? (
            <EditDenForm
              den={den}
              onSaved={(updated) => {
                setDen(updated);
                setEditing(false);
                loadFeed(); // posts show the den's new picture
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <p className="den-desc">{den.description}</p>
              <p className="den-meta">
                <i className="fa-regular fa-calendar" aria-hidden="true"></i>
                Created {formatDate(den.created)}
                {den.ownerUsername && (
                  <>
                    {" "}by{" "}
                    <a className="den-owner" href={`/profile?id=${den.ownerId}`}>
                      <Avatar src={den.ownerProfilePic} size={20} />
                      {den.ownerUsername}
                    </a>
                  </>
                )}
              </p>

              <div className="den-actions">
                <JoinButton den={den} onChange={setDen} small />
                {den.isMember && (
                  <a className="btn btn-primary btn-sm" href={`/create?den=${encodeURIComponent(den.name)}`}>
                    <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> New post
                  </a>
                )}
                {den.isOwner && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
                    <i className="fa-solid fa-pen" aria-hidden="true"></i> Edit den
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <Status status={error} />

      {feed === null ? (
        !error && <span className="loader" role="status" aria-label="Loading posts"></span>
      ) : feed.length === 0 ? (
        <div className="empty-state">
          No posts in {den.name} yet.
          {den.isMember && (
            <>
              {" "}<a className="link-btn" href={`/create?den=${encodeURIComponent(den.name)}`}>Create the first one</a>
            </>
          )}
        </div>
      ) : (
        <div className="feed-list">
          {feed.map((item) => (
            <PostCard
              key={`${item.isPoll ? "poll" : "post"}-${item.id}`}
              item={item}
              currentUser={currentUser}
              onChange={loadFeed}
              onShowVoters={setVotersPoll}
              showDen={false}
            />
          ))}
        </div>
      )}

      {votersPoll && <VotersModal poll={votersPoll} onClose={closeVoters} />}
      {showMembers && <MembersModal den={den} onClose={closeMembers} />}
    </main>
  );
}


interface EditDenFormProps {
  den: Den;
  onSaved: (den: Den) => void;
  onCancel: () => void;
}

// Owner only: change the den's description and picture. The name can't change (it's the den's link).
function EditDenForm({ den, onSaved, onCancel }: EditDenFormProps) {
  const [description, setDescription] = useState(den.description);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setRemoveImage(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);

    const form = new FormData();
    form.append("description", description.trim());
    if (file) form.append("file", file);
    if (removeImage) form.append("removeImage", "true");

    try {
      const data = await api(`/dens/${den.id}`, { method: "PUT", body: form });
      onSaved(data.den);
    } catch (err) {
      setStatus({ type: "error", text: errorText(err) });
      setSaving(false);
    }
  }

  const shownImage = removeImage ? null : (previewUrl ?? den.image);

  return (
    <form className="form den-edit" onSubmit={save}>
      <div className="field">
        <span className="label">Picture</span>
        <div className="settings-row">
          <DenAvatar name={den.name} image={shownImage} size={56} />
          <div className="button-row">
            <label className="btn btn-secondary btn-sm">
              <i className="fa-solid fa-image" aria-hidden="true"></i> {shownImage ? "Change" : "Upload"}
              <input type="file" accept="image/*" className="sr-only" onChange={pickFile} />
            </label>
            {shownImage && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setRemoveImage(true);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="den-edit-desc">Description</label>
        <textarea
          id="den-edit-desc"
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={MAX_DEN_DESCRIPTION}
          rows={3}
          required
        />
        <span className="hint">{description.length}/{MAX_DEN_DESCRIPTION}</span>
      </div>

      <Status status={status} />

      <div className="button-row">
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !description.trim()}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
