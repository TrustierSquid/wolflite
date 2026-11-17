/** True when `text` contains the search (ignoring case and surrounding spaces); everything matches an empty search */
export const matchesSearch = (text: string | null | undefined, search: string) =>
  !search.trim() || (text ?? "").toLowerCase().includes(search.trim().toLowerCase());
