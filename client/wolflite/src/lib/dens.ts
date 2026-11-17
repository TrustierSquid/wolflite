import { api } from "./api";

/**
 * Roles in a den:
 *   owner      created it; edits / deletes it, picks moderators, removes anyone
 *   moderator  deletes posts and comments in the den, removes regular members
 *   member     everyone else who joined
 */
export type DenRole = "owner" | "moderator" | "member";

/** A den (community) as the /dens API returns it */
export interface Den {
  id: number;
  name: string;
  description: string;
  /** Den picture, or null to show the letter placeholder */
  image: string | null;
  created: string;
  ownerId: number;
  ownerUsername: string | null;
  /** Owner's profile picture (null = default picture) */
  ownerProfilePic: string | null;
  memberCount: number;
  /** Posts + polls */
  postCount: number;
  /** Whether the logged in user joined it (always false for guests) */
  isMember: boolean;
  isOwner: boolean;
  /** The logged in user's role here, or null when they aren't in it (or are a guest) */
  myRole: DenRole | null;
  /** Owner or moderator: can delete posts / comments and remove members */
  canModerate: boolean;
}

/** The den info attached to every post / poll in a feed */
export interface DenSummary {
  id: number;
  name: string;
  image: string | null;
}

// Same rules as the server (routes/dens.py)
export const DEN_NAME_RULE = /^[A-Za-z0-9_-]{3,24}$/;
export const DEN_NAME_HINT = "3-24 characters: letters, numbers, underscores and hyphens. This is also the den's link.";
export const MAX_DEN_DESCRIPTION = 300;

export const denHref = (name: string) => `/den?name=${encodeURIComponent(name)}`;

/** Every den, biggest first; with joinedOnly, the dens the logged in user is in */
export async function listDens(joinedOnly = false): Promise<Den[]> {
  const data = await api(`/dens/list${joinedOnly ? "?joined=true" : ""}`);
  return data.dens ?? [];
}

export async function getDen(name: string): Promise<Den> {
  const data = await api(`/dens/info/${encodeURIComponent(name)}`);
  return data.den;
}

/** Joins (or with join = false, leaves) a den. Returns the updated den. */
export async function setMembership(den: Pick<Den, "id">, join: boolean): Promise<Den> {
  const data = await api(`/dens/${den.id}/join`, { method: join ? "POST" : "DELETE" });
  return data.den;
}

/** Someone in a den */
export interface DenMember {
  id: number;
  username: string;
  profilePic: string | null;
  role: DenRole;
  /** When they joined */
  joined: string;
}

/** Everyone in a den, owner first */
export async function listMembers(den: Pick<Den, "id">): Promise<DenMember[]> {
  const data = await api(`/dens/${den.id}/members`);
  return data.members ?? [];
}

/** Removes someone from a den (owner: anyone but themselves; moderators: regular members). Returns the updated den. */
export async function removeMember(den: Pick<Den, "id">, userId: number): Promise<Den> {
  const data = await api(`/dens/${den.id}/members/${userId}`, { method: "DELETE" });
  return data.den;
}

/** Owner only: make a member a moderator, or a moderator a regular member */
export async function setMemberRole(den: Pick<Den, "id">, userId: number, role: "moderator" | "member") {
  await api(`/dens/${den.id}/members/${userId}/role`, { method: "PUT", json: { role } });
}

/** Owner only: deletes the den and everything posted in it. confirmName must be the den's name. */
export async function deleteDen(den: Pick<Den, "id">, confirmName: string) {
  await api(`/dens/${den.id}`, { method: "DELETE", json: { confirmName } });
}

export const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
