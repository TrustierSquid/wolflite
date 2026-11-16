import { useEffect, useState } from "react";
import { api } from "./api";

// The logged in user is requested once per page load and shared by every
// component that asks for it (navbar, feed, profile...), instead of each
// component fetching /getUserData on its own.
let currentUserRequest = null;

export function fetchCurrentUser() {
  if (!currentUserRequest) {
    currentUserRequest = api("/getUserData").then((data) => ({
      id: data.currentUserID,
      username: data.currentUserName,
      profilePic: data.currentUserPfPicture,
      joinedDate: data.joinedDate,
      bio: data.bio,
    }));
  }
  return currentUserRequest;
}

// React hook: returns the logged in user, or null while it is loading.
export function useCurrentUser() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((loadedUser) => active && setUser(loadedUser))
      .catch((error) => console.log(error));
    return () => {
      active = false;
    };
  }, []);

  return user;
}
