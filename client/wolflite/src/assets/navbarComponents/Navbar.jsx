import React, { useEffect } from "react";
import { useState } from "react";


function Navbar() {

  return (
    <nav id="navContainer">
      <section className="navContainerSection" onClick={()=> window.location.href = '/'}>
        <img id="navImg" src="./src/assets/imgs/wolfLogo.png" alt="" />
        <h2>WOLFLITE</h2>
      </section>

      <ul className="navContainerSectionLinks">
        <li onClick={()=> {window.location.href = '/blog'}}>
          <a href="#" >Home <i className="fa-solid fa-house"></i></a>
        </li>
        <li>
          <a href="/blog">Profile <i className="fa-solid fa-user"></i></a>
        </li>
        <li id="navCreatePost" onClick={()=> {window.location.href = '/create'}}>
          <a href="#" >Create <i className="fa-solid fa-plus"></i></a>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
