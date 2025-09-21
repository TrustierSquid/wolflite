import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import './assets/stylesheets/navbarStyles.css'
import './assets/stylesheets/index.css'
import './assets/stylesheets/sideNav.css'
import './assets/stylesheets/profile.css'
import './assets/stylesheets/customAnimations.css'
import Navbar from "./assets/navbarComponents/Navbar.jsx";
import ProfileUI from "./assets/profileComponents/ProfileUI.jsx";
import { useEffect, useState } from "react";


// const [mappedData, setMappedData] = useState(null)

let mappedData = []
// Fetches the Username and UID for the logged in user
function StageUserData() {
  const [currentLoggedInData, setCurrentLoggedInData] = useState(null)

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
          userPfPic: data.currentUserPfPicture
        });

      } catch (error) {
        console.log(error);
      }
    }

    getUserData()
  }, [])



  return (
    <>

      {currentLoggedInData && (
        <ProfileUI
          currentLoggedInUserId={currentLoggedInData?.userId}
          currentLoggedInUsername={currentLoggedInData?.username}
          currentLoggedInUserProfilePic={currentLoggedInData?.userPfPic}
        />
      )}
    </>
  )
}


createRoot(document.getElementById('root')).render(
   <StrictMode>
      <Navbar/>
      <StageUserData/>
   </StrictMode>
)