import React, { useEffect } from "react";
import { useState } from "react";


function Navbar() {
  const [isNavOpen, setIsNavOpen] = useState(false)

  function openNav(){
    setIsNavOpen(prev => true)
    document.body.style.overflow = "hidden";

    if (isNavOpen) {
      setIsNavOpen(prev => false)
      document.body.style.overflow = "auto";
    }

  }

  return (
    <>
      <nav id="navContainer">
        <section className="navContainerSection" onClick={()=> window.location.href = '/login'}>
          <img id="navImg" src="./src/assets/imgs/wolfLogo.png" alt="" />
          <h2>WOLFLITE</h2>
        </section>

        {/* Mobile Nav Button */}
        <button id="mobileNavButton" onClick={()=> openNav()}><i className="fa-solid fa-bars"></i></button>

        <ul className="navContainerSectionLinks">
          <li onClick={()=> {window.location.href = '/blog'}}>
            <a href="#" >Home</a>
          </li>
          <li id="navCreatePost" onClick={()=> {window.location.href = '/create'}}>
            <a href="#" >Create <i className="fa-solid fa-plus"></i></a>
          </li>
        </ul>
      </nav>

      <menu className={isNavOpen ? "navBarOpen animate__animated animate__fadeInLeft" : "navMobileMenu" }>
        <h4 id="mobileNavTitle">MENU</h4>
        <ul id="mobileNavList">
          <li onClick={()=> {window.location.href = '/blog'}}>
            <a href="#" ><i className="fa-solid fa-house"></i> Home</a>
          </li>
          <li onClick={()=> {window.location.href = '/profile'}}>
            <a href="#"><i className="fa-solid fa-user"></i> Profile</a>
          </li>
          <li  onClick={()=> {window.location.href = '/create'}}>
            <a href="#" ><i className="fa-solid fa-plus"></i> Create</a>
          </li>
        </ul>
      </menu>
    </>
  );
}

export default Navbar;
