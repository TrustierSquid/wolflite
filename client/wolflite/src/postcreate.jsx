import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import './assets/stylesheets/navbarStyles.css'
import './assets/stylesheets/index.css'
import './assets/stylesheets/sideNav.css'
import './assets/stylesheets/profile.css'
import './assets/stylesheets/customAnimations.css'
import Navbar from "./assets/navbarComponents/Navbar.jsx";
import PopupForm from './assets/popupComponents/PopupForm.jsx'

createRoot(document.getElementById('root')).render(
   <StrictMode>
      <Navbar/>
      <PopupForm/>
   </StrictMode>
)