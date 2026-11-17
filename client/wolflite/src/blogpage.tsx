import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar.jsx";
import { WithNotifications } from "./components/NotificationsPanel";
import FeedPage from "./pages/FeedPage.jsx";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <WithNotifications>
      <FeedPage />
    </WithNotifications>
  </StrictMode>
);
