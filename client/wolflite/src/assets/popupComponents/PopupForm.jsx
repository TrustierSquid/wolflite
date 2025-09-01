import { useState, useEffect, useRef } from "react";

export default function PopupForm() {
  // For changing the menu option when the user clicks an option (text, image or poll)
  const [menuSelector, setMenuSelector] = useState("standard");
  const [imageUrl, setImageUrl] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const formRef = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    console.log(formData);
    const file = formData.get('file')

    // If no photo was uploaded then send the data as is
    if (!file || file.size === 0) {
      formData.delete('file')
    }

    const response = await fetch("/post/create", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      alert("Upload failed");
      console.log(response)
      return;
    }

    const data = await response.json();
    setSuccessMessage("Upload Successful");
    setTimeout(() => {
      window.location.href = "/blog";
    }, 1000);

    if (data.url) {
      setImageUrl(data.url);
    }


  }

  return (
    <>
      <main id="elementContainer">
        <h2 className="moodleTitle">Create Post</h2>

        <div id="createMenuContainer">
          <ul id="createMenuOptions">
            <li onClick={() => setMenuSelector("standard")}>
              <h3>Standard</h3>
            </li>
            <li onClick={() => setMenuSelector("Poll")}>
              <h3>Poll</h3>
            </li>
          </ul>

          {menuSelector === "standard" ? (
            <section id="createMenuContent">
              <form
                id="createPostForm"
                ref={formRef}
                onSubmit={handleUpload}
              >
                <h2>Standard</h2>
                <br />

                <div id="imageInsertContainer">
                  <input
                    type="file"
                    name="file"
                  />
                  {imageUrl && (
                    <img
                      src={`http://localhost:5000${imageUrl}`}
                      alt="Uploaded"
                    />
                  )}
                </div>

                <div className="formPostTitleSection">
                  <label
                    className="createPostFormLabel"
                    for="postTitle"
                  >
                    Post Title:
                  </label>
                  <br />
                  <input
                    className="createPostFormInputTitle"
                    name="postTitle"
                    type="text"
                    placeholder="Enter a post title"
                    required
                  />
                </div>

                <div className="formPostBodySection">
                  <label
                    className="createPostFormLabel"
                    for="postContent"
                  >
                    Post Body:
                  </label>
                  <br />
                  <textarea
                    className="createPostFormInput"
                    type="text"
                    name="postContent"
                    placeholder="Enter a post Body"
                    required
                  />
                </div>

                <span className="successMessage">{successMessage}</span>
                <button
                  type="submit"
                  id="submitTextBtn"
                >
                  Post
                </button>
              </form>
            </section>
          ) : (
            <section id="createMenuContent">
              <h2>Text Post</h2>
              <br />
              <form
                action="/post/create"
                method="POST"
                id="createPostForm"
              >
                <div className="formPostTitleSection">
                  <label
                    className="createPostFormLabel"
                    for="postTitle"
                  >
                    Post Title:
                  </label>
                  <br />
                  <input
                    className="createPostFormInputTitle"
                    name="postTitle"
                    type="text"
                    placeholder="Enter a post title"
                  />
                </div>

                <div className="formPostBodySection">
                  <label
                    className="createPostFormLabel"
                    for="postContent"
                  >
                    Post Body:
                  </label>
                  <br />
                  <textarea
                    className="createPostFormInput"
                    type="text"
                    name="postContent"
                    placeholder="Enter a post Body"
                  />
                </div>
                <button
                  type="submit"
                  id="submitTextBtn"
                >
                  Post
                </button>
              </form>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
