import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import Navbar from "./components/Navbar.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

// profile.html and settings.html share this entry
const isSettings = window.location.pathname === "/settings";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    {isSettings ? <SettingsPage /> : <ProfilePage />}
  </StrictMode>
);
