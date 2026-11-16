import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import Navbar from "./components/Navbar.jsx";
import CreatePage from "./pages/CreatePage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Navbar />
    <CreatePage />
  </StrictMode>
);
