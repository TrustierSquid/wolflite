import { useEffect, useState, useRef } from "react";
import SideNav from "../navbarComponents/SideNav";

export default function ProfileUI(props) {
  // console.log(props)
  const [allUserPosts, setAllUserPosts] = useState([]);
  const [postImgLoaded, setpostImgLoaded] = useState(null);
  const formRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState("");

  console.log(props);

  useEffect(() => {
    try {
      // Fetches profile posts from the current logged in user
      async function fetchProfilePosts() {
        const response = await fetch("/profileInfo/fetch", {
          method: "GET",
          // headers: {"Content-Type": "application/json"}
        });

        if (!response.ok) {
          throw new Error("Tried and failed getting the user's posts.");
        }

        const data = await response.json();
        setAllUserPosts(data);
      }

      fetchProfilePosts();
    } catch (error) {
      console.log(error);
    }
  }, []);

  // Changing profile Picture
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
        `/post/updateProfilePicture/${props.currentLoggedInUserId}`,
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
        window.location.href = "/profile";
      }, 1000);

      const data = await response.json();

      if (data.profileImg) {
        console.log("Change");
      }
    } catch (error) {
      console.log(error);
    }
  }

  // Post date formatting for post and poll timestamps
  function timeAgo(time) {
    const date = new Date(time);
    const today = new Date();
    const diffMs = today - date; // difference in milliseconds
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  return (
    <>
      <main id="homeContainer">
        <SideNav
          loggedInUserId={props.loggedInUserId}
          loggedInUsername={props.currentLoggedInUsername}
          currentLoggedInUserProfilePic={props.currentLoggedInUserProfilePic}
        />

        <section id="blogFeedContainer">
          <h2 className="text-gradient">Your Profile</h2>
          <article id="profileInformation">
            <section className="profileInformationItem">
              <img
                className="profileInformationPic"
                id="defaultPfPic"
                src={
                  props.currentLoggedInUserProfilePic
                    ? `http://localhost:5000${props.currentLoggedInUserProfilePic}`
                    : "src/assets/imgs/defaultUser.jpg"
                }
                alt=""
              />
              <h1>{props.currentLoggedInUsername}</h1>
              <h5 id="userIDDisplay">#DHNSI</h5>
            </section>

            <form
              ref={formRef}
              className="profileInformationItem"
            >
              <label
                className="profilePictureSelectorLabel"
                htmlFor="profilePictureSelector"
              >
                Change Picture
              </label>
              <input
                type="file"
                id="profilePictureSelector"
                style={{ display: "none" }}
                onChange={changeProfilePicture}
              />
              {/* <button onClick={()=> alert("Coming soon!")}>Change Background <i className="fa-solid fa-images"></i></button> */}
              <label
                className="profilePictureSelectorLabel"
                onClick={() => (window.location.href = "/create")}
              >
                Create <i className="fa-solid fa-plus"></i>
              </label>
            </form>
            <h4 style={{ textAlign: "center", color: "lime" }}>
              {successMessage}
            </h4>
          </article>

          <h2 className="text-gradient">Your Posts</h2>
          {allUserPosts ? (
            allUserPosts?.allUserPosts?.length > 0 ? (
              allUserPosts?.allUserPosts
                ?.map((post, idx) => {
                  return (
                    <section
                      key={post?._id || idx}
                      className="postContainer"
                    >
                      <div className="postHeader">
                        <span className="nameAndProfilePicContainer">
                          <img
                            className="profilePictures"
                            src={
                              props.currentLoggedInUserProfilePic
                                ? `http://localhost:5000${props.currentLoggedInUserProfilePic}`
                                : "src/assets/imgs/defaultUser.jpg"
                            }
                            alt=""
                          />
                          <h5 className="postAuthor">
                            {props.currentLoggedInUsername}
                          </h5>
                        </span>

                        <span className="postTimestamp">
                          posted {timeAgo(post.created)}
                        </span>
                      </div>
                      <h2>{post?.title}</h2>
                      <p>{post?.body}</p>
                      {post.postPic && (
                        <>
                          {!postImgLoaded && <span className="loader"></span>}
                          <img
                            src={`http://localhost:5000/${post.postPic}`}
                            alt="postPic"
                            style={postImgLoaded ? {} : { display: "none" }}
                            onLoad={() => setpostImgLoaded(true)}
                            onError={() => setpostImgLoaded(true)}
                          />
                        </>
                      )}
                    </section>
                  );
                })
                .reverse()
            ) : (
              <span className="emptyPostContainer">You have no posts yet!</span>
            )
          ) : (
            <span>loading</span>
          )}
        </section>
      </main>
    </>
  );
}
