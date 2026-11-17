import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import DenAvatar from "../components/DenAvatar";
import Status from "../components/Status";
import { api } from "../lib/api";
import { useRequiredUser } from "../lib/currentUser";
import { cancelUpload, formatBytes, getMaxUploadBytes, uploadInChunks, uploadSizeError } from "../lib/upload";
import type { UploadSession } from "../lib/upload";
import { DEN_NAME_HINT, DEN_NAME_RULE, MAX_DEN_DESCRIPTION, denHref, listDens } from "../lib/dens";
import type { Den } from "../lib/dens";

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 12;

// /create                 new post (or poll / den with the toggle)
// /create?den=homelab     ...with that den already picked
// /create?type=den        start on "new den"
export default function CreatePage() {
  const params = new URLSearchParams(window.location.search);
  const currentUser = useRequiredUser(); // sends guests to the login page
  const startMode = params.get("type") === "den" ? "den" : params.get("type") === "poll" ? "poll" : "post";
  const [mode, setMode] = useState(startMode);

  // Dens you can post in (the ones you joined); null while loading
  const [dens, setDens] = useState<Den[] | null>(null);
  const [denId, setDenId] = useState<number | null>(null);
  const wantedDen = params.get("den")?.toLowerCase();

  useEffect(() => {
    if (!currentUser) return;
    listDens(true)
      .then((joined) => {
        setDens(joined);
        const preselected = joined.find((den) => den.name.toLowerCase() === wantedDen) ?? joined[0];
        setDenId(preselected?.id ?? null);
      })
      .catch(() => setDens([]));
  }, [currentUser, wantedDen]);

  if (!currentUser) {
    return (
      <main className="page">
        <span className="loader" role="status" aria-label="Loading"></span>
      </main>
    );
  }

  const den = dens?.find((d) => d.id === denId) ?? null;

  return (
    <main className="page">
      <section className="card create-card">
        <div className="create-card-header">
          <h1 className="page-title">Create</h1>
          <div className="segmented" role="group" aria-label="What to create">
            <button type="button" aria-pressed={mode === "post"} onClick={() => setMode("post")}>
              <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> Post
            </button>
            <button type="button" aria-pressed={mode === "poll"} onClick={() => setMode("poll")}>
              <i className="fa-solid fa-square-poll-horizontal" aria-hidden="true"></i> Poll
            </button>
            <button type="button" aria-pressed={mode === "den"} onClick={() => setMode("den")}>
              <i className="fa-solid fa-people-group" aria-hidden="true"></i> Den
            </button>
          </div>
        </div>

        {mode === "den" ? (
          <DenForm />
        ) : dens === null ? (
          <span className="loader" role="status" aria-label="Loading your dens"></span>
        ) : dens.length === 0 ? (
          // Every post lives in a den, so you need to be in one first
          <div className="empty-state">
            <p>
              <i className="fa-solid fa-people-group" aria-hidden="true"></i> Posts live in dens, and you haven't joined one yet.
            </p>
            <div className="button-row empty-actions">
              <a className="btn btn-primary btn-sm" href="/blog?tab=discover">
                <i className="fa-solid fa-compass" aria-hidden="true"></i> Discover dens
              </a>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode("den")}>
                <i className="fa-solid fa-plus" aria-hidden="true"></i> Create a den
              </button>
            </div>
          </div>
        ) : (
          <>
            <DenPicker dens={dens} value={denId} onChange={setDenId} />
            {mode === "post" ? <PostForm den={den} /> : <PollForm den={den} />}
          </>
        )}
      </section>
    </main>
  );
}


// Which den the post / poll goes in (only dens you joined)
function DenPicker({ dens, value, onChange }: { dens: Den[]; value: number | null; onChange: (id: number) => void }) {
  const selected = dens.find((den) => den.id === value);

  return (
    <div className="field">
      <label className="label" htmlFor="post-den">Den</label>
      <div className="den-picker">
        {selected && <DenAvatar name={selected.name} image={selected.image} size={38} />}
        <select
          id="post-den"
          className="input"
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          required
        >
          {dens.map((den) => (
            <option key={den.id} value={den.id}>{den.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}


function PostForm({ den }: { den: Den | null }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  // Media upload progress (null when not uploading)
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  // The current upload, so "Post" after a failure resumes instead of starting over
  const session = useRef<UploadSession | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Free the preview's memory when it is replaced or the form goes away
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Set right before going to the den after posting, so the warning below doesn't fire
  const finished = useRef(false);

  // Leaving the page mid-upload would throw the upload away: ask first
  useEffect(() => {
    if (!progress) return;
    const warn = (e: BeforeUnloadEvent) => {
      if (finished.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  // A different (or no) file: the old upload is no use any more
  function forgetUpload() {
    cancelUpload(session.current);
    session.current = null;
  }

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    // Too big: say so now, instead of after writing the whole post
    const tooBig = uploadSizeError(picked);
    if (tooBig) {
      setStatus({ type: "error", text: tooBig });
      return;
    }
    forgetUpload();
    setStatus(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function removeFile() {
    forgetUpload();
    setFile(null);
    setPreviewUrl(null);
  }

  function cancel() {
    abort.current?.abort();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setStatus(null);

    const form = new FormData();
    form.append("postTitle", title.trim());
    form.append("postContent", body.trim());
    if (den) form.append("denId", String(den.id));

    try {
      // Media goes up first, in pieces (works for big videos behind Cloudflare too)
      if (file) {
        abort.current = new AbortController();
        setProgress({ sent: 0, total: file.size });
        const uploadId = await uploadInChunks(file, {
          resume: session.current,
          signal: abort.current.signal,
          onSession: (s) => (session.current = s),
          onProgress: (sent, total) => setProgress({ sent, total }),
        });
        form.append("uploadId", uploadId);
      }

      await api("/post/create", { method: "POST", body: form });
      session.current = null;
      finished.current = true; // posted: leaving now is fine
      window.location.href = den ? denHref(den.name) : "/blog";
    } catch (err) {
      setProgress(null);
      setSending(false);
      if ((err as Error).name === "AbortError") {
        forgetUpload();
        setStatus({ type: "error", text: "Upload cancelled." });
      } else {
        const text = err instanceof Error ? err.message : "Couldn't post";
        const resumable = session.current ? " Press Post to try again; the upload carries on where it stopped." : "";
        setStatus({ type: "error", text: text + resumable });
      }
    }
  }

  const percent = progress ? Math.floor((progress.sent / Math.max(progress.total, 1)) * 100) : 0;
  const kind = file?.type.startsWith("video/") ? "video" : "image";

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="post-title">Title</label>
        <input
          id="post-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Give your post a title"
          maxLength={150}
          required
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="post-body">Body</label>
        <textarea
          id="post-body"
          className="textarea"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's on your mind?"
          maxLength={1000}
          rows={6}
          required
        />
        <span className="hint">{body.length}/1000</span>
      </div>

      <div className="field">
        <span className="label">Media (optional)</span>
        {previewUrl && file ? (
          <div className="media-preview">
            {kind === "video" ? (
              <video src={previewUrl} controls />
            ) : (
              <img src={previewUrl} alt="Preview of the selected image" />
            )}
            {!progress && (
              <button type="button" className="icon-btn media-remove" onClick={removeFile} aria-label="Remove media">
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            )}
          </div>
        ) : (
          <div>
            <label className="btn btn-secondary">
              <i className="fa-solid fa-image" aria-hidden="true"></i> Add photo or video
              <input type="file" accept="image/*,video/*" className="sr-only" onChange={pickFile} />
            </label>
            <p className="hint upload-limit">Up to {formatBytes(getMaxUploadBytes())}</p>
          </div>
        )}
      </div>

      {progress && file && (
        <div className="upload-progress" role="status" aria-live="polite">
          <div className="upload-progress-top">
            <span>
              <i className={`fa-solid ${kind === "video" ? "fa-film" : "fa-image"}`} aria-hidden="true"></i>{" "}
              Uploading {kind}… <strong>{percent}%</strong>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={cancel}>
              Cancel
            </button>
          </div>
          <div
            className="upload-progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Upload progress"
          >
            <div className="upload-progress-fill" style={{ width: `${percent}%` }}></div>
          </div>
          <span className="hint">
            {formatBytes(progress.sent)} of {formatBytes(progress.total)}
          </span>
        </div>
      )}

      <Status status={status} />

      <div className="form-footer">
        <span></span>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>{" "}
          {progress ? "Uploading…" : sending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}


function PollForm({ den }: { den: Den | null }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const setOption = (index, value) => setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  const addOption = () => setOptions((prev) => (prev.length < MAX_POLL_OPTIONS ? [...prev, ""] : prev));
  const removeOption = (index) => setOptions((prev) => prev.filter((_, i) => i !== index));

  async function submit(e) {
    e.preventDefault();
    const filledOptions = options.map((opt) => opt.trim()).filter(Boolean);

    if (filledOptions.length < MIN_POLL_OPTIONS) {
      setStatus({ type: "error", text: "A poll needs at least two options." });
      return;
    }

    setSending(true);
    setStatus(null);
    try {
      await api("/post/poll/create", {
        method: "POST",
        json: { question: question.trim(), options: filledOptions, denId: den?.id },
      });
      window.location.href = den ? denHref(den.name) : "/blog";
    } catch (err) {
      setStatus({ type: "error", text: err.message });
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="poll-question">Question</label>
        <textarea
          id="poll-question"
          className="textarea"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do you want to ask?"
          maxLength={250}
          rows={3}
          required
        />
      </div>

      <div className="field">
        <span className="label">Options</span>
        {options.map((option, index) => (
          <div className="option-row" key={index}>
            <input
              className="input"
              value={option}
              onChange={(e) => setOption(index, e.target.value)}
              placeholder={`Option ${index + 1}`}
              aria-label={`Option ${index + 1}`}
              maxLength={100}
              required
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => removeOption(index)}
              disabled={options.length <= MIN_POLL_OPTIONS}
              aria-label={`Remove option ${index + 1}`}
            >
              <i className="fa-solid fa-trash" aria-hidden="true"></i>
            </button>
          </div>
        ))}
      </div>

      <Status status={status} />

      <div className="form-footer">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={addOption}
          disabled={options.length >= MAX_POLL_OPTIONS}
        >
          <i className="fa-solid fa-plus" aria-hidden="true"></i> Add option
        </button>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          <i className="fa-solid fa-square-poll-horizontal" aria-hidden="true"></i> {sending ? "Creating…" : "Create poll"}
        </button>
      </div>
    </form>
  );
}


// New den: name (also its link), description and an optional picture.
// You become its owner and first member.
function DenForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "error"; text: string } | null>(null);

  // Free the preview's memory when it is replaced or the form goes away
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    // Too big: say so now, instead of after writing the whole post
    const tooBig = uploadSizeError(picked);
    if (tooBig) {
      setStatus({ type: "error", text: tooBig });
      return;
    }
    setStatus(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  const nameValid = DEN_NAME_RULE.test(name);
  const showNameError = name !== "" && !nameValid;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!nameValid) {
      setStatus({ type: "error", text: "Den names are 3-24 characters: letters, numbers, underscores and hyphens." });
      return;
    }

    setSending(true);
    setStatus(null);

    const form = new FormData();
    form.append("name", name);
    form.append("description", description.trim());
    if (file) form.append("file", file);

    try {
      const data = await api("/dens/create", { method: "POST", body: form });
      window.location.href = denHref(data.den.name);
    } catch (err) {
      setStatus({ type: "error", text: err instanceof Error ? err.message : "Couldn't create the den" });
      setSending(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="field">
        <span className="label">Picture (optional)</span>
        <div className="settings-row">
          <DenAvatar name={name || "?"} image={previewUrl} size={64} />
          <div className="button-row">
            <label className="btn btn-secondary btn-sm">
              <i className="fa-solid fa-image" aria-hidden="true"></i> {previewUrl ? "Change picture" : "Add picture"}
              <input type="file" accept="image/*" className="sr-only" onChange={pickFile} />
            </label>
            {previewUrl && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="den-name">Name</label>
        <input
          id="den-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value.replace(/\s/g, ""))}
          placeholder="e.g. homelab"
          maxLength={24}
          aria-invalid={showNameError}
          aria-describedby="den-name-hint"
          required
        />
        <span id="den-name-hint" className={`hint${showNameError ? " hint-error" : ""}`}>
          {DEN_NAME_HINT}
        </span>
      </div>

      <div className="field">
        <label className="label" htmlFor="den-desc">Description</label>
        <textarea
          id="den-desc"
          className="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this den about?"
          maxLength={MAX_DEN_DESCRIPTION}
          rows={3}
          required
        />
        <span className="hint">{description.length}/{MAX_DEN_DESCRIPTION}</span>
      </div>

      <Status status={status} />

      <div className="form-footer">
        <span></span>
        <button type="submit" className="btn btn-primary" disabled={sending || !description.trim()}>
          <i className="fa-solid fa-people-group" aria-hidden="true"></i> {sending ? "Creating…" : "Create den"}
        </button>
      </div>
    </form>
  );
}
