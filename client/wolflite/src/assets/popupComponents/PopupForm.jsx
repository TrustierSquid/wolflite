import { useState, useEffect, useRef } from "react";

export default function PopupForm() {
  // For changing the menu option when the user clicks an option (text, image or poll)
  const [menuSelector, setMenuSelector] = useState("standard");
  const [imageUrl, setImageUrl] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const formRef = useRef(null);
  const pollForm = useRef(null);

  async function handleUpload(e) {
    e.preventDefault();
    const formData = new FormData(formRef.current);
    const file = formData.get('file')

    // If no photo was uploaded then send the data as is
    if (!file || file.size === 0) {
      formData.delete('file')
    }

    try {
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
    } catch (error) {
      console.log(error)
    }


  }


  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState([''])

  // handle question change
  const handleQuestionChange = (e) => setQuestion(e.target.value)

  // Handle change for an option
  const handleOptionChange = (index, value) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  // Add a new option
  const addOption = ()=> options.length === 12 ? setOptions([...options]) : setOptions([...options, ""])


  // Remove an option
  const removeOption = (index)=> {
    setOptions(options.filter((_, i) => i !== index))
  }

  async function handlePollUploads(e) {
    e.preventDefault()
    const payload = {
      question,
      options: options.filter((opt)=> opt.trim() !== ""),
    }

    console.log(payload)

    console.log("Submitting poll:", payload);

    try {
      const response = await fetch('/post/poll/create', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        alert("Poll Upload Failed")
        console.log(response)
        return
      }

      const data = await response.json()
      setSuccessMessage("Upload Successful");
      // setQuestion("");
      // setOptions([""]);
      setTimeout(() => {
        window.location.href = "/blog";
      }, 1000);
    } catch (error){
      console.log(error)
    }


  }

  return (
    <>
      <main id="elementContainer">
        <h2 className="moodleTitle">Create</h2>

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
                    maxLength={65}
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
                    maxLength={300}
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
              <h2>Create Poll</h2>
              <br />
              <form
                method="POST"
                ref={pollForm}
                onSubmit={handlePollUploads}
              >
                <main id="createPostForm">
                  {/* POLL QUESTION */}
                  <div className="formPostTitleSection">


                    <label
                      className="createPostFormLabel"
                      for="pollQuestion"
                    >
                      Poll Question:
                    </label>
                    <br />
                    <input
                      className="createPostFormInputTitle"
                      name="pollQuestion"
                      type="text"
                      onChange={handleQuestionChange}
                      required
                      placeholder="Enter a post title"
                      maxLength={200}
                    />
                  </div>

                  {/* POLL OPTIONS */}
                  {
                    options.map((option, index) => (
                      <div key={index} className="formPostBodySection">
                        <br />
                        <label
                          className="createPostFormLabel"
                          for="pollOption"
                        >
                          Poll Option:
                        </label>
                        <br />

                        <input
                          className="createPostFormInput"
                          type="text"
                          name="pollOption"
                          value={option}
                          placeholder={`Option ${index + 1}`}
                          onChange={(e)=> handleOptionChange(index, e.target.value)}
                          maxLength={100}
                          required
                        />

                        {
                          option.length < 1 && (
                            <button type="button" id="removePollOptionButton" onClick={()=> removeOption(index)}>Remove</button>
                          )
                        }
                      </div>
                    ))
                  }
                </main>


                <span className="successMessage">{successMessage}</span>
                <section id="functionBtns">
                  {/* Add Option Button */}
                  <button type="button" onClick={addOption} id="addPollOptionButton" >
                    Add Answer
                  </button>

                  <button
                    onClick={(e)=> handlePollUploads}
                    id="submitTextBtn"
                  >
                    Create Post
                  </button>
                </section>

              </form>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
