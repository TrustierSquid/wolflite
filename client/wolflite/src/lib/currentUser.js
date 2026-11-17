import { useEffect, useState } from "react";
import { api } from "./api";
import { loginHref } from "./auth";
import { adoptAccountAppearance } from "./theme";
import { setMaxUploadBytes } from "./upload";

/**
 * Saves the theme mode / accent color to the logged in user's account.
 * @param {{ mode?: string, accent?: string }} appearance
 */
export function saveAccountAppearance({ mode, accent }) {
  return api("/profileInfo/appearance", { method: "PUT", json: { theme: mode, accent } });
}

// The logged in user is requested once per page load and shared by every
// component that asks for it (navbar, feed, profile...), instead of each
// component fetching /getUserData on its own.

/**
 * @typedef {object} CurrentUser
 * @property {number} id
 * @property {string} username
 * @property {string | null} profilePic
 * @property {string} joinedDate
 * @property {string | null} bio
 */

/** @type {Promise<CurrentUser | null> | null} */
let currentUserRequest = null;

/**
 * The logged in user, or null for guests (not logged in).
 * @returns {Promise<CurrentUser | null>}
 */
export function fetchCurrentUser() {
  if (!currentUserRequest) {
    currentUserRequest = api("/getUserData").then((data) => {
      // Theme / accent follow the account; guests get the defaults
      const unsaved = adoptAccountAppearance(data ?? { loggedIn: false });
      if (unsaved) saveAccountAppearance(unsaved).catch((error) => console.log(error));
      // The server's upload limit, so file pickers can check sizes before uploading
      setMaxUploadBytes(data?.maxUploadBytes);

      return data?.loggedIn
        ? {
            id: data.currentUserID,
            username: data.currentUserName,
            profilePic: data.currentUserPfPicture,
            joinedDate: data.joinedDate,
            bio: data.bio,
          }
        : null;
    });
  }
  return currentUserRequest;
}

// React hook. Returns:
//   undefined     while loading
//   null          for guests (not logged in)
//   CurrentUser   for the logged in user
/** @returns {CurrentUser | null | undefined} */
export function useCurrentUser() {
  const [user, setUser] = useState(/** @type {CurrentUser | null | undefined} */ (undefined));

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((loadedUser) => active && setUser(loadedUser))
      .catch((error) => {
        console.log(error);
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return user;
}

// For pages that only make sense with an account (create, settings): same as
// useCurrentUser, but sends guests to the login page (and back here afterwards).
// The server already redirects these pages; this covers the Vite dev server.
/** @returns {CurrentUser | null | undefined} */
export function useRequiredUser() {
  const user = useCurrentUser();

  useEffect(() => {
    if (user === null) window.location.replace(loginHref());
  }, [user]);

  return user;
}
