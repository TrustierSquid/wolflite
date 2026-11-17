import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import { fetchCurrentUser } from "./lib/currentUser";
import LoginPage from "./pages/LoginPage.jsx";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

// Applies the account's theme / accent, or the defaults when logged out
// (e.g. the session expired without logging out)
fetchCurrentUser().catch((error) => console.log(error));

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>
);
