// Inline success / error message under a form.
// `status` is null (shows nothing) or { type: "success" | "error", text: "..." }
export default function Status({ status }) {
  if (!status) return null;

  const isError = status.type === "error";

  return (
    <p className={`status ${isError ? "status-error" : "status-success"}`} role={isError ? "alert" : "status"}>
      <i className={`fa-solid ${isError ? "fa-circle-exclamation" : "fa-circle-check"}`} aria-hidden="true"></i>
      {status.text}
    </p>
  );
}
