import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import './assets/stylesheets/navbarStyles.css'
import './assets/stylesheets/index.css'
import './assets/stylesheets/sideNav.css'
import './assets/stylesheets/profile.css'
import Navbar from "./assets/navbarComponents/Navbar.jsx";
import BlogFeed from "./assets/blogComponents/BlogFeed.jsx";

createRoot(document.getElementById('root')).render(
   <StrictMode>
      <Navbar/>
      <BlogFeed/>
   </StrictMode>
)