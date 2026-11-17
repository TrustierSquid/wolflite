import { useState } from "react";
import { nextPage } from "../lib/auth";
import { adoptAccountAppearance } from "../lib/theme";

// "/login" shows the login form, "/" shows the create account form.
// ?next=/some/page sends the user back there afterwards (e.g. the den they were looking at).
export default function LoginPage() {
  const isLogin = window.location.pathname === "/login";
  // Keep ?next= when switching between the two forms
  const search = window.location.search;
  const [showPassword, setShowPassword] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function logIn(form) {
    const response = await fetch("/loginUser", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));
    if (data.success) {
      // Switch to the account's theme / accent before leaving, so the next page
      // doesn't flash in the default colors
      try {
        const account = await fetch("/getUserData").then((r) => r.json());
        adoptAccountAppearance(account);
      } catch {
        // The next page applies it anyway
      }
      window.location.href = nextPage();
      return true;
    }
    setError(data.message || "Login failed. Please try again.");
    return false;
  }

  async function createAccount(form) {
    const response = await fetch("/formSubmission", { method: "POST", body: form });
    const data = await response.json().catch(() => ({}));

    if (data.sanitationError) return setError(data.sanitationError);
    if (data.errorMessage) return setError("That username is already taken.");
    if (!response.ok) return setError("Could not create the account. Please try again.");

    // Account created: log straight in with the same username and password
    await logIn(form);
  }

  async function submit(e) {
    e.preventDefault();
    setSending(true);
    setError("");

    const form = new FormData(e.currentTarget);
    try {
      if (isLogin) await logIn(form);
      else await createAccount(form);
    } catch {
      setError("Could not reach the server. Please try again.");
    }
    setSending(false);
  }

  return (
    <main className="auth-page">
      <section className="card auth-card">
        <div className="auth-brand">
          <img src="/static/uploads/wolfLogo.png" alt="Wolflite" />
          <h1 className="auth-title">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="auth-subtitle">
            {isLogin ? "Log in to pick up where you left off." : "Join Wolflite and start posting."}
          </p>
        </div>

        <form className="form" onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              name="username"
              placeholder="Username"
              autoComplete="username"
              maxLength={30}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                className="input"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />
              <button
                type="button"
                className="icon-btn password-toggle"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`} aria-hidden="true"></i>
              </button>
            </div>
            {!isLogin && (
              <p className="hint">At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.</p>
            )}
          </div>

          {error && (
            <p className="status status-error" role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i> {error}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={sending}>
            {isLogin ? "Log in" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? (
            <>New to Wolflite? <a href={`/${search}`}>Create an account</a></>
          ) : (
            <>Already have an account? <a href={`/login${search}`}>Log in</a></>
          )}
        </p>

        <a className="btn btn-ghost btn-block" href="/blog">
          <i className="fa-solid fa-compass" aria-hidden="true"></i> Browse without an account
        </a>

        <div className="guest-box">
          Just looking around? Use the guest account:
          <br />
          Username <code>HiringGuest</code> · Password <code>PassWord01%</code>
        </div>
      </section>
    </main>
  );
}
