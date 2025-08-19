import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import './assets/stylesheets/navbarStyles.css'
import './assets/stylesheets/index.css'
import Navbar from "./assets/navbar/Navbar.jsx";

createRoot(document.getElementById('root')).render(
   <StrictMode>
      <Navbar/>
   </StrictMode>
)