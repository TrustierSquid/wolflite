import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar.jsx";
import { WithNotifications } from "./components/NotificationsPanel";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

// profile.html and settings.html share this entry
const isSettings = window.location.pathname === "/settings";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <WithNotifications>{isSettings ? <SettingsPage /> : <ProfilePage />}</WithNotifications>
  </StrictMode>
);
