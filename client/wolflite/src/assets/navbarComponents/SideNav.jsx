import { useState, useRef } from "react";

export default function SideNav(props) {
  const [imageUrl, setImageUrl] = useState(null);
  const formRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState("");

  async function changeProfilePicture() {
    /*
      Accessing the file input element:
      formRef.current.querySelector('input[type="file"]');
      This uses a ref (formRef) to get the current form DOM node, then finds the file input inside it.

      Getting the selected file:
      const file = fileInput.files[0];
      The .files property is a FileList of selected files. [0] gets the first file (for single file uploads).

      Checking if a file is selected:
      if (!file) { alert("No file selected"); return; }
      If no file is chosen, it alerts the user and stops further execution.

      Preparing the file for upload:
      const formData = new FormData(); formData.append('file', file);
      This creates a FormData object and appends the file under the key 'file'. This is commonly used for uploading files via AJAX (e.g., with fetch or axios).

    */
    const fileInput = formRef.current.querySelector('input[type="file"]');
    const file = fileInput.files[0];
    if (!file) {
      alert("No file selected");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);


    try {
      const response = await fetch(
        `/post/updateProfilePicture/${props.loggedInUserId}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (!response.ok) {
        alert("Upload failed");
        console.log(response);
        return;
      }

      setSuccessMessage("Profile Picture Changed!");
      setTimeout(() => {
        window.location.href = "/blog";
      }, 1000);

      const data = await response.json();

      if (data.profileImg) {
        console.log("Change");
      }
    } catch (error) {
      console.log(error)
    }

  }


  // Helper function for smooth scrolling
  function handleSmoothScroll(e, whichView) {
    e.preventDefault();
    // Scroll a little above the target element (e.g., 80px offset)
    const offset = 70;
    let element;

    if (whichView === "postView") {
      element = props?.postScrollRef?.current;

      if (element) {
        const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    } else {
      element = props?.pollScrollRef?.current;

      if (element) {
        const y = element.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }

  }

  return (
    <>
      <nav id="sidenavContainer">
        <section id="profileSection" className="animate__animated animate__fadeInLeft">
          <div id="userInformation">
            <br />
            <div id="pictureSelectorContainer">
              <form
                id="pictureSelectorForm"
                ref={formRef}
              >
                <input
                  id="pictureSelector"
                  type="file"
                  onChange={changeProfilePicture}
                />
                <img
                  id="defaultPfPic"
                  src={
                    props?.currentLoggedInUserProfilePic
                      ? `${import.meta.env.VITE_SERVER}${props?.currentLoggedInUserProfilePic}`
                      : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
                  }
                  alt=""
                />
              </form>
              <div id="userRoleContainer">
                <h3 style={{ color: "black", textAlign: "center" }}>{props?.loggedInUsername}</h3>
                <h5 id="userRole">Change Profile Picture</h5>
              </div>
            </div>
            <h4 style={{ textAlign: "center", color: "lime" }}>{successMessage}</h4>

            <article id="sideNavButtonContainer">
              <h4 id="sideNavTitle">MENU</h4>
              <button
                className="sideNavButton"
                onClick={() => (window.location.href = "/blog")}
              >
                <i className="fa-solid fa-house"></i>
                <h3>Home</h3>
              </button>
              <button
                className="sideNavButton"
                onClick={() => (window.location.href = "/create")}
              >
                <i className="fa-solid fa-plus"></i>
                <h3>Create</h3>
              </button>
              <button
                className="sideNavButton"
                onClick={() => (window.location.href = `/profile?id=${props?.loggedInUserId}`)}
              >
                <i className="fa-solid fa-user"></i>
                <h3>My Profile</h3>
              </button>
              <button
                className="sideNavButton"
                onClick={() => (window.location.href = "/login")}
              >
                <i className="fa-solid fa-right-from-bracket"></i>
                <h3>Logout</h3>
              </button>
            </article>



          </div>
        </section>
        {/* <div id="scrollButtons" className="animate__animated animate__fadeInLeft">
          <a href="#postView" onClick={e => handleSmoothScroll(e, "postView")}><i className="fa-solid fa-comment-nodes"></i>  Posts <i className="fa-solid fa-arrow-down"></i></a>
          <a href="#pollView" onClick={e => handleSmoothScroll(e, "pollView")}><i className="fa-solid fa-square-poll-horizontal"></i> Polls <i className="fa-solid fa-arrow-up"></i></a>
        </div> */}
      </nav>
    </>
  );
}
