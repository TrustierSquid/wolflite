import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import Navbar from "./components/Navbar.jsx";
import FeedPage from "./pages/FeedPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <FeedPage />
  </StrictMode>
);
