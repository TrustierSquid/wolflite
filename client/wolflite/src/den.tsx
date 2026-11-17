import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar";
import DenPage from "./pages/DenPage";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Navbar />
    <DenPage />
  </StrictMode>
);
