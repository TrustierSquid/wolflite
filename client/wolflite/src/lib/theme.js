// Theme preference: "system" (follow the OS), "light" or "dark".
// Stored per browser. Each HTML page also has a tiny inline script that applies
// the saved theme before React loads, so the page never flashes the wrong theme.
const STORAGE_KEY = "wolflite-theme";

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

export function setThemePreference(preference) {
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage can be blocked (private mode); the theme still applies for this page
  }

  if (preference === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = preference;
}
