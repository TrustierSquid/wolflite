import { useCallback, useEffect, useState } from "react";
import Avatar from "../components/Avatar";
import PostCard from "../components/PostCard";
import Status from "../components/Status";
import VotersModal from "../components/VotersModal";
import { api } from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";
import { formatDate } from "../lib/time";

const TABS = [
  { key: "posts", label: "Posts", field: "allUserPosts", empty: "No posts yet." },
  { key: "polls", label: "Polls", field: "allUserPolls", empty: "No polls yet." },
  { key: "liked", label: "Liked", field: "likedPosts", empty: "No liked posts yet." },
  // Your stash list (bookmarks). Private, so only shown on your own profile.
  { key: "stashed", label: "Stashed", field: "stashed", empty: "Nothing stashed yet. Use the bookmark or ⋮ menu on any post or poll to stash it.", ownerOnly: true },
];

const newestFirst = (items) => [...(items ?? [])].sort((a, b) => new Date(b.created) - new Date(a.created));

// /profile?id=N  (without an id it shows your own profile)
export default function ProfilePage() {
  const currentUser = useCurrentUser();
  const profileId = new URLSearchParams(window.location.search).get("id") || currentUser?.id;

  const [profile, setProfile] = useState(null); // null while loading
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [pictureStatus, setPictureStatus] = useState(null);
  const [tab, setTab] = useState("posts");
  const [votersPoll, setVotersPoll] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    try {
      const data = await api(`/profileInfo/fetch?id=${encodeURIComponent(profileId)}`);
      if (data === null) {
        setNotFound(true); // the server answers 204 for users that don't exist
        return;
      }
      setProfile(data);
      setError(null);
    } catch (err) {
      setError({ type: "error", text: err.message });
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const closeVoters = useCallback(() => setVotersPoll(null), []);

  async function changePicture(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    setPictureStatus(null);
    try {
      await api("/post/updateProfilePicture", { method: "PUT", body: form });
      await loadProfile();
    } catch (err) {
      setPictureStatus({ type: "error", text: err.message });
    }
  }

  if (notFound) {
    return (
      <main className="page">
        <div className="empty-state">
          <i className="fa-solid fa-user-slash" aria-hidden="true"></i> This user doesn't exist.
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="page">
        {error ? <Status status={error} /> : <span className="loader" role="status" aria-label="Loading profile"></span>}
      </main>
    );
  }

  const isOwnProfile = currentUser?.id === profile.userId;
  const visibleTabs = TABS.filter((t) => !t.ownerOnly || isOwnProfile);
  const activeTab = visibleTabs.find((t) => t.key === tab) ?? visibleTabs[0];
  const items = newestFirst(profile[activeTab.field]);

  return (
    <main className="page">
      <section className="card profile-header">
        <Avatar src={profile.userProfilePic} size={88} alt={`${profile.username}'s profile picture`} />

        <div className="profile-info">
          <h1 className="profile-name">{profile.username}</h1>
          <p className="profile-joined">
            <i className="fa-regular fa-calendar" aria-hidden="true"></i>
            Joined {formatDate(profile.joinedDate)}
          </p>
          {profile.bio && <p className="profile-bio">{profile.bio}</p>}

          {isOwnProfile && (
            <div className="profile-actions">
              <label className="btn btn-secondary btn-sm">
                <i className="fa-solid fa-image" aria-hidden="true"></i> Change picture
                <input type="file" accept="image/*" className="sr-only" onChange={changePicture} />
              </label>
              <a className="btn btn-secondary btn-sm" href="/settings">
                <i className="fa-solid fa-gear" aria-hidden="true"></i> Settings
              </a>
            </div>
          )}
          <Status status={pictureStatus} />
        </div>
      </section>

      <div className="tabs" role="tablist" aria-label="Profile content">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            className="tab"
            aria-selected={activeTab.key === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Status status={error} />

      <div className="feed-list" role="tabpanel">
        {items.length > 0 ? (
          items.map((item) => (
            <PostCard
              key={`${item.isPoll ? "poll" : "post"}-${item.id}`}
              item={item}
              currentUser={currentUser}
              onChange={loadProfile}
              onShowVoters={setVotersPoll}
            />
          ))
        ) : (
          <div className="empty-state">{activeTab.empty}</div>
        )}
      </div>

      {votersPoll && <VotersModal poll={votersPoll} onClose={closeVoters} />}
    </main>
  );
}
