import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import { syncAppearanceAcrossTabs } from "./lib/theme";
import Navbar from "./components/Navbar";
import SideNav from "./components/SideNav";
import MessagesPage from "./pages/MessagesPage";

// Theme / accent changes made in another tab apply here too
syncAppearanceAcrossTabs();

// Side nav pinned on the left (wide screens) and the two-pane messages view in
// the space next to it. No notification panel here: the conversation needs the room.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Navbar />
    <div className="messages-layout">
      <SideNav />
      <MessagesPage />
    </div>
  </StrictMode>
);
