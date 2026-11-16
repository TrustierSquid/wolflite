import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/main.css";
import LoginPage from "./pages/LoginPage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LoginPage />
  </StrictMode>
);
