import React from "react";

function Navbar() {
  return (
    <nav id="navContainer">
      <section className="navContainerSection">
        <img id="navImg" src="./src/assets/imgs/wolfLogo.png" alt="" />
        <h2>WOLF</h2>
      </section>

      <ul className="navContainerSectionLinks">
        <li>
          <a href="#">Post</a>
        </li>
        <li>
          <a href="#">Changelog</a>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
