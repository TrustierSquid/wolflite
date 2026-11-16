// Ends the session on the server, then sends the user to the login page.
// Just navigating to /login is not enough: the session cookie would stay valid.
export async function logout() {
  try {
    await fetch("/logout", { method: "POST" });
  } catch (error) {
    console.log(error);
  }
  window.location.href = "/login";
}
