// Guests can browse Wolflite; anything that changes something (posting, liking,
// commenting, joining a den...) needs an account. When a guest tries one of those,
// the server answers 401 and the "log in to continue" prompt opens (LoginPrompt).

const LOGIN_REQUIRED_EVENT = "wolflite:login-required";

/** Thrown by api() when the server says the visitor needs to log in */
export class LoginRequiredError extends Error {
  constructor(message = "Log in to do that") {
    super(message);
    this.name = "LoginRequiredError";
  }
}

export const isLoginRequired = (error: unknown): error is LoginRequiredError =>
  error instanceof LoginRequiredError;

/** Opens the "log in to continue" prompt. `reason` says what they were trying to do. */
export function requireLogin(reason?: string) {
  window.dispatchEvent(new CustomEvent<string | undefined>(LOGIN_REQUIRED_EVENT, { detail: reason }));
}

/** Calls `listener` whenever something asks the visitor to log in. Returns an unsubscribe function. */
export function onLoginRequired(listener: (reason?: string) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<string | undefined>).detail);
  window.addEventListener(LOGIN_REQUIRED_EVENT, handler);
  return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, handler);
}

// Where to come back to after logging in: the current page
const here = () => window.location.pathname + window.location.search;

/** Login page link that brings the visitor back to this page afterwards */
export const loginHref = (next = here()) => `/login?next=${encodeURIComponent(next)}`;

/** Create account page link that brings the visitor back to this page afterwards */
export const signupHref = (next = here()) => `/?next=${encodeURIComponent(next)}`;

/**
 * The page to go to after logging in: ?next= if it is a page on this site, else the home feed.
 * Only same-site paths are allowed ("/den?name=x"), never "//evil.com" or "https://...".
 */
export function nextPage(search = window.location.search) {
  const next = new URLSearchParams(search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return "/blog";
}
