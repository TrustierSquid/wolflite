import React, { useEffect } from "react";
import { useState } from "react";


function Navbar(props) {
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [currentLoggedInData, setCurrentLoggedInData] = useState(null)

  // opening and closing mobile navbar
  function openNav(){
    setIsNavOpen(prev => true)
    document.body.style.overflow = "hidden";

    if (isNavOpen) {
      setIsNavOpen(prev => false)
      document.body.style.overflow = "auto";
    }

  }


  let mappedData = []
  const endpoint = window.location.pathname;
  // Fetches the Username and UID for the logged in user
  useEffect(()=> {
    async function getUserData(){
      try {
        const response = await fetch("/getUserData", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        if(response.status === 401) {
          window.location.href = "/login"
        }

        if (!response.ok) {
          throw new Error(`HTTP error! ${response.status}`);
        }

        const data = await response.json()
        setCurrentLoggedInData({
          username: data.currentUserName,
          userId: data.currentUserID,
          userPfPic: data.currentUserPfPicture,
          joinedDate: data.joinedDate
        });

      } catch (error) {
        console.log(error);
      }
    }

    getUserData()
  }, [])



  return (
    <>
      <nav id="navContainer">
        <div id="navTitle">
          <section className="navContainerSection" onClick={()=> window.location.href = '/login'}>
            <img id="navImg" src={`${import.meta.env.VITE_SERVER}/static/uploads/wolfLogo.png`} alt="" />
          </section>
          <h1 className="universalHeader" style={{color: "var(--primary)"}}>
            {endpoint === '/blog' ? `Home` : endpoint === '/profile' ? `Profile` : endpoint === `/create` ? `Create` : endpoint === `/settings` ? `Settings` : '' }
          </h1>
        </div>


        {/* Mobile Nav Button */}
        <button id="mobileNavButton" onClick={()=> openNav()}><i className="fa-solid fa-bars"></i></button>

        <ul className="navContainerSectionLinks">
          <li className="navLink" onClick={()=> {window.location.href = '/blog'}}>
            <a href="#" >Home</a>
          </li>
          <li className="navLink" onClick={()=> {window.location.href = `/profile?id=${currentLoggedInData.userId}`}}>
            <a href="#">Profile</a>
          </li>
          <li id="navCreatePost" onClick={()=> {window.location.href = '/create'}}>
            <a href="#" >Create Post</a>
          </li>
        </ul>
      </nav>

      <menu className={isNavOpen ? "navBarOpen animate__animated animate__fadeInLeft" : "navMobileMenu" }>
        <div id="mobileNavUserInformation">
          <img src={
              currentLoggedInData?.userPfPic
              ? `${import.meta.env.VITE_SERVER}${currentLoggedInData?.userPfPic}`
              : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
            }
            alt="pic"
            id="mobileNavPfPic"
            />
            <h3>{currentLoggedInData?.username}</h3>
            <p id="navJoinedDate">
              {`Joined WOLFLITE: ` + new Date(currentLoggedInData?.joinedDate).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric"
              })}
            </p>
        </div>

        <h4 id="mobileNavTitle">MENU</h4>
        <ul id="mobileNavList">
          <li onClick={()=> {window.location.href = '/blog'}}>
            <a href="#" ><i className="fa-solid fa-house"></i> Home</a>
          </li>
          <li onClick={()=> {window.location.href = `/profile?id=${currentLoggedInData.userId}`}}>
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
