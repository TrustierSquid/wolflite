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
        <li>
          <a href="/blog">Home</a>
        </li>
        <li>
          <a href="#" onClick={()=> {window.location.href = '/create'}}>Post</a>
        </li>
        <li>
          <a href="#">Changelog</a>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
