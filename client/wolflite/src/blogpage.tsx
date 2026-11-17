import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar.jsx";
import AppLayout from "./components/AppLayout";
import FeedPage from "./pages/FeedPage.jsx";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <AppLayout>
      <FeedPage />
    </AppLayout>
  </StrictMode>
);
