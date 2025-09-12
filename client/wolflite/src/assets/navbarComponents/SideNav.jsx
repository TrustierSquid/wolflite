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

    console.log(formData);

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

  return (
    <section id="profileSection">
      <div id="userInformation">
        {/* <h4 style={{ color: "white", textAlign: "center" }}>
          ID: #UIA25{props?.loggedInUserId}
        </h4> */}
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
            {/* <img id="defaultPfPic" src={"/src/assets/imgs/defaultUser.jpg" || `http://localhost:5000/${imageUrl}`} alt="pic"  /> */}
            <img
              id="defaultPfPic"
              src={
                `http://localhost:5000/${props?.currentLoggedInUserProfilePic}`
                  ? `http://localhost:5000/${props?.currentLoggedInUserProfilePic}`
                  : "/src/assets/imgs/defaultUser.jpg"
              }
              alt=""
            />
          </form>
          <h3 style={{ color: "white", textAlign: "center" }}>
            {props?.loggedInUsername}
            <br />

          </h3>
        </div>
        <h4 style={{ textAlign: "center", color: "lime" }}>{successMessage}</h4>
        <article id="sideNavButtonContainer">
          <button
            className="sideNavButton"
            onClick={() => (window.location.href = "/blog")}
          >
            Home <i className="fa-solid fa-house"></i>
          </button>
          <button
            className="sideNavButton"
            onClick={() => (window.location.href = "/create")}
          >
            Create Post <i className="fa-solid fa-plus"></i>
          </button>
        </article>
        <button
          className="sideNavButton"
          onClick={() => (window.location.href = "/create")}
        >
          My profile <i className="fa-solid fa-user"></i>
        </button>
        <button
          className="sideNavButton"
          onClick={() => (window.location.href = "/login")}
        >
          Logout <i className="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </section>
  );
}
