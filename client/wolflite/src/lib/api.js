// Small wrapper around fetch for talking to the Flask API.
//  - sends `json` as a JSON body, or `body` as-is (FormData for uploads)
//  - sends the user to /login when the session has expired (401)
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

  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Not logged in");
  }

  // 204 (no content) and non-JSON responses come back as null
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 413) throw new Error("That file is too large (max 50 MB).");
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}
