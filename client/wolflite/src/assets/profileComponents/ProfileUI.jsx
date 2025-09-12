import { useEffect } from "react"
import SideNav from "../navbarComponents/SideNav"


export default function ProfileUI(props){
  // console.log(props)

  useEffect(()=> {
    try {
      // Fetches profile posts from the current logged in user
      async function fetchProfilePosts() {
        const response = await fetch('/profileInfo/fetch', {
          method: "GET",
          // headers: {"Content-Type": "application/json"}
        })

        if (!response.ok) {
          throw new Error("Tried and failed getting the user's posts.");

        }

        const data = await response.json()
        console.log(data)
      }

      fetchProfilePosts()

    } catch (error) {
      console.log(error)
    }

  }, [])

  return (
    <>
      <main id="homeContainer">
        <SideNav
          loggedInUserId={props.loggedInUserId}
          loggedInUsername={props.currentLoggedInUsername}
          currentLoggedInUserProfilePic={props.currentLoggedInUserProfilePic}
        />

        <section id="blogFeedContainer">
          <article id="profileInformation">
            <div id="profileSpecificBackground">
            </div>

            <section className="profileInformationItem">
              <img id="defaultPfPic" className="profileInformationPic"
              src={`http://localhost:5000/${props.currentLoggedInUserProfilePic}` ? `http://localhost:5000${props.currentLoggedInUserProfilePic}` : "src/assets/imgs/defaultUser.jpg"} alt="" />
              <h1>{props.currentLoggedInUsername}</h1>
              <h5 id="userIDDisplay">#DHNSI</h5>
            </section>

            <section className="profileInformationItem">
              <button>Change Picture <i className="fa-solid fa-image-portrait"></i></button>
              <button onClick={()=> alert("Coming soon!")}>Change Background <i className="fa-solid fa-images"></i></button>
              <button onClick={()=> window.location.href = '/create'}>Create <i className="fa-solid fa-plus"></i></button>
            </section>
          </article>


        </section>
      </main>
    </>
  )
}