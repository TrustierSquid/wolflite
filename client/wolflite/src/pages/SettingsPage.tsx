import { useState } from "react";
import Avatar from "../components/Avatar";
import Status from "../components/Status";
import { api } from "../lib/api";
import { useCurrentUser } from "../lib/currentUser";
import { logout } from "../lib/logout";
import { getThemePreference, setThemePreference } from "../lib/theme";

// Same rule the server uses when creating an account
const USERNAME_RULE = /^[A-Za-z0-9._-]{5,30}$/;

export default function SettingsPage() {
  const currentUser = useCurrentUser();
  // Changes made on this page, applied on top of the loaded user
  const [changes, setChanges] = useState({});

  if (!currentUser) {
    return (
      <main className="page">
        <span className="loader" role="status" aria-label="Loading settings"></span>
      </main>
    );
  }

  const user = { ...currentUser, ...changes };
  const update = (fields) => setChanges((prev) => ({ ...prev, ...fields }));

  return (
    <main className="page">
      <h1 className="page-title">Settings</h1>
      <PictureSection user={user} onUpdate={update} />
      <UsernameSection user={user} onUpdate={update} />
      <BioSection user={user} onUpdate={update} />
      <AppearanceSection />
      <AccountSection user={user} />
    </main>
  );
}


function SectionHeader({ title, description }) {
  return (
    <div>
      <h2 className="section-title">{title}</h2>
      {description && <p className="section-desc">{description}</p>}
    </div>
  );
}


function PictureSection({ user, onUpdate }) {
  const [status, setStatus] = useState(null);

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const form = new FormData();
    form.append("file", file);
    try {
      const data = await api("/post/updateProfilePicture", { method: "PUT", body: form });
      onUpdate({ profilePic: data.profileImg });
      setStatus({ type: "success", text: "Profile picture updated." });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  async function remove() {
    try {
      await api("/profileInfo/deleteProfilePic", { method: "PUT" });
      onUpdate({ profilePic: null });
      setStatus({ type: "success", text: "Profile picture removed." });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  return (
    <section className="card settings-section">
      <SectionHeader title="Profile picture" description="Shown next to your posts and comments." />
      <div className="settings-row">
        <Avatar src={user.profilePic} size={72} alt="Your profile picture" />
        <div className="button-row">
          <label className="btn btn-secondary btn-sm">
            <i className="fa-solid fa-upload" aria-hidden="true"></i> Upload new
            <input type="file" accept="image/*" className="sr-only" onChange={upload} />
          </label>
          {user.profilePic && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={remove}>
              <i className="fa-solid fa-trash" aria-hidden="true"></i> Remove
            </button>
          )}
        </div>
      </div>
      <Status status={status} />
    </section>
  );
}


function UsernameSection({ user, onUpdate }) {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState(null);

  async function save(e) {
    e.preventDefault();
    const newUsername = username.trim();

    if (!USERNAME_RULE.test(newUsername)) {
      setStatus({
        type: "error",
        text: "Usernames are 5-30 characters: letters, numbers, dots, underscores and hyphens.",
      });
      return;
    }

    try {
      await api("/profileInfo/changeUsername", { method: "PUT", json: { newUsername } });
      onUpdate({ username: newUsername });
      setUsername("");
      setStatus({ type: "success", text: "Username changed." });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  return (
    <section className="card settings-section">
      <SectionHeader title="Username" description={`Currently @${user.username}`} />
      <form className="inline-form" onSubmit={save}>
        <input
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="New username"
          aria-label="New username"
          maxLength={30}
        />
        <button type="submit" className="btn btn-primary" disabled={!username.trim()}>
          Save
        </button>
      </form>
      <Status status={status} />
    </section>
  );
}


function BioSection({ user, onUpdate }) {
  const [bio, setBio] = useState(user.bio ?? "");
  const [status, setStatus] = useState(null);
  const unchanged = bio === (user.bio ?? "");

  async function save(e) {
    e.preventDefault();
    try {
      await api("/profileInfo/changeBio", { method: "PUT", json: { newBio: bio } });
      onUpdate({ bio: bio.trim() });
      setStatus({ type: "success", text: "Bio saved." });
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    }
  }

  return (
    <section className="card settings-section">
      <SectionHeader title="Bio" description="A few words about you, shown on your profile." />
      <form className="form" onSubmit={save}>
        <textarea
          className="textarea"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people about yourself"
          aria-label="Bio"
          maxLength={500}
        />
        <div className="form-footer">
          <span className="hint">{bio.length}/500</span>
          <button type="submit" className="btn btn-primary" disabled={unchanged}>
            Save bio
          </button>
        </div>
      </form>
      <Status status={status} />
    </section>
  );
}


const THEME_OPTIONS = [
  { value: "system", label: "System", icon: "fa-desktop" },
  { value: "light", label: "Light", icon: "fa-sun" },
  { value: "dark", label: "Dark", icon: "fa-moon" },
];

function AppearanceSection() {
  const [theme, setTheme] = useState(getThemePreference);

  function choose(value) {
    setTheme(value);
    setThemePreference(value);
  }

  return (
    <section className="card settings-section">
      <SectionHeader title="Appearance" description="System follows your device's light or dark setting." />
      <div className="segmented" role="group" aria-label="Theme">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
          >
            <i className={`fa-solid ${option.icon}`} aria-hidden="true"></i> {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}


function AccountSection({ user }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState(null);

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api("/profileInfo/deleteProfile", { method: "DELETE" });
      window.location.href = "/login";
    } catch (err) {
      setStatus({ type: "error", text: err.message });
      setDeleting(false);
    }
  }

  return (
    <section className="card settings-section danger-zone">
      <SectionHeader title="Account" />
      <div className="button-row">
        <button type="button" className="btn btn-secondary" onClick={logout}>
          <i className="fa-solid fa-right-from-bracket" aria-hidden="true"></i> Log out
        </button>
        {!confirming && (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            <i className="fa-solid fa-trash" aria-hidden="true"></i> Delete account
          </button>
        )}
      </div>

      {confirming && (
        <div className="confirm-box">
          <p>
            Delete <strong>@{user.username}</strong>? This can't be undone.
          </p>
          <div className="button-row">
            <button type="button" className="btn btn-primary" onClick={deleteAccount} disabled={deleting}>
              Yes, delete my account
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Status status={status} />
    </section>
  );
}
