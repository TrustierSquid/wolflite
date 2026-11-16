import { useEffect, useState } from "react";
import Status from "../components/Status";
import { api } from "../lib/api";

const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 12;

export default function CreatePage() {
  const [mode, setMode] = useState("post");

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
          </div>
        </div>

        {mode === "post" ? <PostForm /> : <PollForm />}
      </section>
    </main>
  );
}


function PostForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  // Free the preview's memory when it is replaced or the form goes away
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(e) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  function removeFile() {
    setFile(null);
    setPreviewUrl(null);
  }

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setStatus(null);

    const form = new FormData();
    form.append("postTitle", title.trim());
    form.append("postContent", body.trim());
    if (file) form.append("file", file);

    try {
      await api("/post/create", { method: "POST", body: form });
      window.location.href = "/blog";
    } catch (err) {
      setStatus({ type: "error", text: err.message });
      setSending(false);
    }
  }

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
        {previewUrl ? (
          <div className="media-preview">
            {file.type.startsWith("video/") ? (
              <video src={previewUrl} controls />
            ) : (
              <img src={previewUrl} alt="Preview of the selected image" />
            )}
            <button type="button" className="icon-btn media-remove" onClick={removeFile} aria-label="Remove media">
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        ) : (
          <div>
            <label className="btn btn-secondary">
              <i className="fa-solid fa-image" aria-hidden="true"></i> Add photo or video
              <input type="file" accept="image/*,video/*" className="sr-only" onChange={pickFile} />
            </label>
          </div>
        )}
      </div>

      <Status status={status} />

      <div className="form-footer">
        <span></span>
        <button type="submit" className="btn btn-primary" disabled={sending}>
          <i className="fa-solid fa-paper-plane" aria-hidden="true"></i> {sending ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}


function PollForm() {
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
        json: { question: question.trim(), options: filledOptions },
      });
      window.location.href = "/blog";
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
