/*
  Upload size limit, checked in the browser before anything is sent.

  The server rejects bigger uploads, but it does so by closing the connection
  while the browser is still sending, which browsers report as a vague
  "NetworkError" / "Failed to fetch". Checking first gives a clear message and
  doesn't waste the upload.

  The real limit comes from the server (MAX_UPLOAD_MB in .env, sent by
  /getUserData); 50 MB is only used until that has loaded.
*/

import { api } from "./api";

let maxUploadBytes = 50 * 1024 * 1024;

export function setMaxUploadBytes(bytes: unknown) {
  if (typeof bytes === "number" && bytes > 0) maxUploadBytes = bytes;
}

export const getMaxUploadBytes = () => maxUploadBytes;

/** "87 MB", "1.4 GB", "740 KB" */
export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  return `${bytes > 0 ? Math.max(1, Math.round(bytes / 1024)) : 0} KB`;
}

/** Error message if the file is too big to upload, or null if it's fine */
export function uploadSizeError(file: File | Blob | null | undefined): string | null {
  if (!file || file.size <= maxUploadBytes) return null;
  const kind = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "file";
  return `That ${kind} is ${formatBytes(file.size)}. The limit is ${formatBytes(maxUploadBytes)}.`;
}

// ---------- Chunked uploads (server side: server/wolfr/routes/uploads.py) ----------

/** Where an upload got to, so a failed one can carry on instead of starting over */
export interface UploadSession {
  file: File;
  uploadId: string;
  chunkSize: number;
}

interface ChunkedUploadOptions {
  /** Called as bytes go out: (bytes sent so far, total) */
  onProgress?: (sent: number, total: number) => void;
  /** Called once the server has created the upload (save it to resume later) */
  onSession?: (session: UploadSession) => void;
  /** A previous attempt for the same file, to resume */
  resume?: UploadSession | null;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const abortError = () => new DOMException("Upload cancelled", "AbortError");

// One piece over XMLHttpRequest (fetch can't report upload progress).
// Resolves with how many bytes the server now has.
function putChunk(uploadId: string, offset: number, piece: Blob, onSent: (bytes: number) => void, signal?: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/upload/${uploadId}?offset=${offset}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => onSent(e.loaded);
    xhr.onload = () => {
      let data: { received?: number; error?: string } | null = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // not JSON
      }
      if (xhr.status === 200 && typeof data?.received === "number") resolve(data.received);
      // The server has a different amount than we thought (409): carry on from there
      else if (xhr.status === 409 && typeof data?.received === "number") resolve(data.received);
      else reject(Object.assign(new Error(data?.error || `Upload failed (${xhr.status})`), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error("Lost the connection while uploading."));
    xhr.onabort = () => reject(abortError());
    if (signal) {
      if (signal.aborted) return reject(abortError());
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(piece);
  });
}

/**
 * Uploads a file in pieces (each well under proxy limits like Cloudflare's 100 MB)
 * and returns the upload id to send with the post (`uploadId`).
 * Each piece is retried a few times; pass `resume` to continue a failed upload.
 */
export async function uploadInChunks(file: File, { onProgress, onSession, resume, signal }: ChunkedUploadOptions = {}) {
  const tooBig = uploadSizeError(file);
  if (tooBig) throw new Error(tooBig);

  let session: UploadSession | null = null;
  let received = 0;

  // Continue a previous attempt for the same file, if the server still has it
  if (resume && resume.file === file) {
    try {
      const status = await api(`/upload/${resume.uploadId}`, { signal });
      session = resume;
      received = status.received;
      if (status.done) {
        onProgress?.(file.size, file.size);
        return resume.uploadId;
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      session = null; // expired: start over
    }
  }

  if (!session) {
    const started = await api("/upload/start", { method: "POST", json: { filename: file.name, size: file.size }, signal });
    session = { file, uploadId: started.uploadId, chunkSize: started.chunkSize };
    onSession?.(session);
  }

  onProgress?.(received, file.size);
  while (received < file.size) {
    const offset = received;
    const piece = file.slice(offset, offset + session.chunkSize);

    for (let attempt = 1; ; attempt++) {
      try {
        received = await putChunk(session.uploadId, offset, piece, (sent) => onProgress?.(offset + sent, file.size), signal);
        break;
      } catch (err) {
        const status = (err as { status?: number }).status;
        // Cancelled, or a problem retrying won't fix (not ours, too big, expired)
        if ((err as Error).name === "AbortError" || (status && status >= 400 && status < 500) || attempt >= 4) throw err;
        await sleep(1000 * 2 ** (attempt - 1)); // 1 s, 2 s, 4 s
      }
    }
    onProgress?.(received, file.size);
  }

  await api(`/upload/${session.uploadId}/finish`, { method: "POST", signal });
  return session.uploadId;
}

/** Cancels an upload on the server (deletes what arrived). Errors are ignored. */
export function cancelUpload(session: UploadSession | null) {
  if (session) api(`/upload/${session.uploadId}`, { method: "DELETE" }).catch(() => {});
}

/** The first file in a form that's too big, as an error message (or null) */
export function formUploadSizeError(body: unknown): string | null {
  if (!(body instanceof FormData)) return null;
  for (const value of body.values()) {
    if (value instanceof Blob) {
      const error = uploadSizeError(value);
      if (error) return error;
    }
  }
  return null;
}
