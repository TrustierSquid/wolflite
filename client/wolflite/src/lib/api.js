import { LoginRequiredError, requireLogin } from "./auth";
import { formatBytes, formUploadSizeError, getMaxUploadBytes } from "./upload";

// Small wrapper around fetch for talking to the Flask API.
//  - sends `json` as a JSON body, or `body` as-is (FormData for uploads)
//  - files over the upload limit are refused before anything is sent
//  - when the visitor isn't logged in (401), opens the "log in to continue"
//    prompt and throws a LoginRequiredError (check with isLoginRequired)
//  - throws an Error with the server's message for any other failed request
/**
 * @param {string} path
 * @param {{ method?: string, json?: unknown, body?: BodyInit, signal?: AbortSignal }} [options]
 * @returns {Promise<any>}
 */
export async function api(path, { method = "GET", json, body, signal } = {}) {
  const options = { method, credentials: "include", signal };

  if (json !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(json);
  } else if (body !== undefined) {
    // The server would cut a too-big upload off halfway, which shows up as a
    // meaningless network error; say what's wrong instead
    const tooBig = formUploadSizeError(body);
    if (tooBig) throw new Error(tooBig);
    options.body = body;
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    // Cancelled on purpose (AbortController): pass that on as is
    if (error?.name === "AbortError") throw error;
    // fetch only throws when no response arrived at all (server down, offline,
    // or the connection was closed mid-upload)
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  // 204 (no content) and non-JSON responses come back as null
  const data = await response.json().catch(() => null);

  if (response.status === 401) {
    requireLogin(data?.error);
    throw new LoginRequiredError(data?.error);
  }

  if (!response.ok) {
    const message =
      response.status === 413 && !data?.error
        ? `That file is too large (max ${formatBytes(getMaxUploadBytes())}).`
        : data?.error || data?.message || `Request failed (${response.status})`;
    // Keep the status and response body for callers that need more than the message
    throw Object.assign(new Error(message), { status: response.status, data });
  }

  return data;
}
