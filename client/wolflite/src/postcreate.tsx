import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar.jsx";
import CreatePage from "./pages/CreatePage.jsx";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <CreatePage />
  </StrictMode>
);
