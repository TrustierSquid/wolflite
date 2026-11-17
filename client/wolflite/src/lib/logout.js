import { resetAppearance } from "./theme";

// Ends the session on the server, then sends the user to the login page.
// Just navigating to /login is not enough: the session cookie would stay valid.
export async function logout() {
  try {
    await fetch("/logout", { method: "POST" });
  } catch (error) {
    console.log(error);
  }
  // The theme / accent belong to the account: logged out pages use the defaults
  resetAppearance();
  window.location.href = "/login";
}
