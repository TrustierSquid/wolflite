import { LoginRequiredError, requireLogin } from "./auth";

// Small wrapper around fetch for talking to the Flask API.
//  - sends `json` as a JSON body, or `body` as-is (FormData for uploads)
//  - when the visitor isn't logged in (401), opens the "log in to continue"
//    prompt and throws a LoginRequiredError (check with isLoginRequired)
//  - throws an Error with the server's message for any other failed request
/**
 * @param {string} path
 * @param {{ method?: string, json?: unknown, body?: BodyInit }} [options]
 * @returns {Promise<any>}
 */
export async function api(path, { method = "GET", json, body } = {}) {
  const options = { method, credentials: "include" };

  if (json !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(json);
  } else if (body !== undefined) {
    options.body = body;
  }

  const response = await fetch(path, options);

  // 204 (no content) and non-JSON responses come back as null
  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    requireLogin(data?.error);
    throw new LoginRequiredError(data?.error);
  }

  if (!response.ok) {
    if (response.status === 413) throw new Error("That file is too large (max 50 MB).");
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}
