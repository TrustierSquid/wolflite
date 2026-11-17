/*
  Appearance preferences: theme mode (system / light / dark) and accent color.

  Saved to the user's account (PUT /profileInfo/appearance, returned by /getUserData),
  so they follow the account and logged out visitors get the defaults (red, follow the OS).
  localStorage keeps a copy for the current browser so pages render in the right
  colors straight away; adoptAccountAppearance() replaces it with the account's
  values on every page load, and logging out clears it.

  Applied as attributes on <html>:
    data-theme="light" | "dark"   (absent = follow the OS)
    data-accent="blue" | ...      (absent = red, the default)
  The CSS in styles/accents.css and styles/theme.css does the rest.

  Each HTML page has a small inline script in <head> that applies the saved
  values before the page renders, so there is no flash of the wrong colors.
  If you rename a storage key, update those scripts too.
*/

export const THEME_MODES = [
  { id: "system", label: "System", icon: "fa-desktop" },
  { id: "light", label: "Light", icon: "fa-sun" },
  { id: "dark", label: "Dark", icon: "fa-moon" },
] as const;

// Add a new accent here AND in styles/accents.css
export const ACCENTS = [
  { id: "red", label: "Red" },
  { id: "orange", label: "Orange" },
  { id: "green", label: "Green" },
  { id: "teal", label: "Teal" },
  { id: "blue", label: "Blue" },
  { id: "purple", label: "Purple" },
  { id: "pink", label: "Pink" },
] as const;

export type ThemeMode = (typeof THEME_MODES)[number]["id"];
export type AccentId = (typeof ACCENTS)[number]["id"];

export interface Appearance {
  mode: ThemeMode;
  accent: AccentId;
}

export const DEFAULT_APPEARANCE: Appearance = { mode: "system", accent: "red" };

const STORAGE_KEYS = {
  mode: "wolflite-theme",
  accent: "wolflite-accent",
} as const;

const isThemeMode = (value: unknown): value is ThemeMode => THEME_MODES.some((m) => m.id === value);
const isAccent = (value: unknown): value is AccentId => ACCENTS.some((a) => a.id === value);

// Storage can throw (blocked cookies, some private modes): fall back to defaults
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not saved, but still applied to the current page
  }
}

/** The saved preferences. Unknown or corrupted values fall back to the defaults. */
export function getAppearance(): Appearance {
  const mode = readStorage(STORAGE_KEYS.mode);
  const accent = readStorage(STORAGE_KEYS.accent);
  return {
    mode: isThemeMode(mode) ? mode : DEFAULT_APPEARANCE.mode,
    accent: isAccent(accent) ? accent : DEFAULT_APPEARANCE.accent,
  };
}

/** Puts the preferences on <html> so the CSS picks them up. */
export function applyAppearance({ mode, accent }: Appearance): void {
  const root = document.documentElement;

  if (mode === "system") delete root.dataset.theme;
  else root.dataset.theme = mode;

  if (accent === DEFAULT_APPEARANCE.accent) delete root.dataset.accent;
  else root.dataset.accent = accent;
}

/** Saves and applies a change to one or both preferences. Returns the full new preferences. */
export function setAppearance(changes: Partial<Appearance>): Appearance {
  const next = { ...getAppearance(), ...changes };

  // Defaults are stored as "nothing saved", so changing a default later reaches everyone
  writeStorage(STORAGE_KEYS.mode, next.mode === DEFAULT_APPEARANCE.mode ? null : next.mode);
  writeStorage(STORAGE_KEYS.accent, next.accent === DEFAULT_APPEARANCE.accent ? null : next.accent);

  applyAppearance(next);
  return next;
}

/** Back to the defaults (used for guests and on logout). */
export function resetAppearance(): void {
  setAppearance(DEFAULT_APPEARANCE);
}

/** What /getUserData says about the visitor's appearance */
export interface AccountAppearance {
  loggedIn: boolean;
  /** null = never chosen */
  theme?: string | null;
  accent?: string | null;
}

/**
 * Applies the appearance saved to the account, or the defaults for guests.
 * Returns the appearance the account should have saved but doesn't yet
 * (see below), or null when nothing needs saving.
 */
export function adoptAccountAppearance(account: AccountAppearance): Appearance | null {
  if (!account.loggedIn) {
    resetAppearance();
    return null;
  }

  // Accounts that never chose (or chose before appearance was saved to accounts):
  // keep what this browser has, and let the caller save it to the account
  if (account.theme == null && account.accent == null) {
    const current = getAppearance();
    const isDefault = current.mode === DEFAULT_APPEARANCE.mode && current.accent === DEFAULT_APPEARANCE.accent;
    return isDefault ? null : current;
  }

  setAppearance({
    mode: isThemeMode(account.theme) ? account.theme : DEFAULT_APPEARANCE.mode,
    accent: isAccent(account.accent) ? account.accent : DEFAULT_APPEARANCE.accent,
  });
  return null;
}

/**
 * Keeps every open tab in step: changing the theme in one tab updates the others.
 * Optional callback receives the new preferences (e.g. to update a settings form).
 * Returns a function that stops listening.
 */
export function syncAppearanceAcrossTabs(onChange?: (appearance: Appearance) => void): () => void {
  function onStorage(e: StorageEvent) {
    // e.key is null when storage was cleared entirely
    if (e.key !== null && e.key !== STORAGE_KEYS.mode && e.key !== STORAGE_KEYS.accent) return;
    const appearance = getAppearance();
    applyAppearance(appearance);
    onChange?.(appearance);
  }

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
