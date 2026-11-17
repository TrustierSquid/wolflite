import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { loginHref, onLoginRequired, signupHref } from "../lib/auth";

// "Log in to continue" popup. Opens whenever a guest tries something that needs
// an account (any API call answered with 401, or requireLogin()).
// Mounted once per page by the Navbar.
export default function LoginPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => onLoginRequired(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);

    // Stop the page behind the popup from scrolling
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  // Rendered at the end of <body>: inside the navbar, its backdrop-filter would
  // trap the fixed-position backdrop within the bar
  return createPortal(
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="card modal login-prompt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="login-prompt-title" className="modal-title">Join the pack</h2>
            <p className="modal-subtitle">Log in or create an account to post, comment, like and join dens.</p>
          </div>
          <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="login-prompt-actions">
          <a className="btn btn-primary btn-block" href={signupHref()} autoFocus>
            <i className="fa-solid fa-user-plus" aria-hidden="true"></i> Create account
          </a>
          <a className="btn btn-secondary btn-block" href={loginHref()}>
            <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i> Log in
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
