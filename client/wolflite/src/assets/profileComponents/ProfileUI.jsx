import { useEffect, useState, useRef } from "react";
import SideNav from "../navbarComponents/SideNav";
import LikeAndComment from "../popupComponents/LikeAndComment";
import { useLocation } from "react-router-dom";

export default function ProfileUI(props) {
  const [allUserPosts, setAllUserPosts] = useState([]);
  const [postImgLoaded, setpostImgLoaded] = useState(null);
  const formRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [animateIndex, setAnimateIndex] = useState(null);
  const commentContainerRef = useRef([])
  const [userNotFoundContent, setUserNotFoundContent] = useState(false)


  // Parse query parameters from the URL
  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  // Grabbing query string
  const query = getQueryParams();
  const queryString = query.toString();
  const queryStringID = query.get("id");



  // Fetches profile posts from the current logged in user
  async function fetchProfilePosts() {
    try {
      const queryString = query.toString();

      const response = await fetch(`/profileInfo/fetch?${queryString}`, {
        method: "GET",
        headers: { "Content-Type": "application/json"},
        credentials: "include"
      });

      // if the searched user does not exist
      if(response.status === 204) {
        console.log(`user not found`)
        setUserNotFoundContent(true)
        return
      }

      // If the user has no session cookie
      if(response.status === 401) {
        window.location.href = "/login"
        return
      }

      if (!response.ok) {
        throw new Error("Tried and failed getting the user's posts.");
      }

      const data = await response.json();
      setAllUserPosts(data);


    } catch (error) {
      console.log(error)
    }
  }

  console.log(allUserPosts)

  useEffect(() => {
    try {
      fetchProfilePosts();
    } catch (error) {
      console.log(error);
    }
  }, []);

  async function addLikeToPost(userId, postID, index, isPoll) {
    // Selecting which button to animate
    setAnimateIndex(index)

    try {
      const response = await fetch(`/post/addLike/${userId}/${postID}/${isPoll}`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({"authorOfLike": userId})
      })

      if(response.status === 401) {
        window.location.href = "/login"
      }

      if (!response.ok) {
        throw new Error("Failed to send like");
      }

      const data = await response.json()
      fetchProfilePosts()
      setTimeout(() => setAnimateIndex(null), 700);
    } catch (error) {
      console.log(error)
    }

  }

  // Calculates the poll numbers (total votes, total votes for each option in a poll)
  async function trackPollNumber(pollID, optionID) {
    try {
      // Sends the poll id and calculates the percentage of users that have selected an answer for each poll
      const response = await fetch("/post/poll/userStats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollID: pollID, optionID: optionID }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! ${response.status}`);
      }

      const data = await response.json();

      /*
        If the user tries to vote again and the client receives an error from the server
        Preventing the User from spamming the api endpoint and voting more than once.
       */
      if (data.error) {
        alert(
          data.error + ". Start a new Poll or wait for this one to expire."
        );
      }

      fetchProfilePosts();
    } catch (err) {
      console.log(err);
    }
  }

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

    try {
      const response = await fetch(
        `/post/updateProfilePicture/${props.currentLoggedInUserId}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if(response.status === 401) {
        window.location.href = "/login"
      }

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


  // Example: addCommentToPost(postIndex)
  async function addCommentToPost(e, postIndex, isPoll) {
    e.preventDefault()

    const commentForm = new FormData(e.target)
    const commentBody = commentForm.get("userComment")


    const response = await fetch("/post/postComment", {
      method: "POST",
      headers: {"Content-type": "application/json"},
      body: JSON.stringify(
        {
          commentBody: commentBody,
          commentAuthor: props?.currentLoggedInUserId,
          postID: postIndex,
          isPoll: isPoll
        }
      )
    })

    if(response.status === 401) {
      window.location.href = "/login"
    }

    fetchProfilePosts()
    const data = await response.json()
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

  console.log(allUserPosts.allUserPolls)

  // Separate arrays for polls and posts to avoid index overlap
  const userPolls = allUserPosts?.allUserPolls || [];
  const userPosts = allUserPosts?.allUserPosts || [];

  return (
    <>
      <main id="homeContainer">
        <SideNav
          loggedInUserId={props.currentLoggedInUserId}
          loggedInUsername={props.currentLoggedInUsername}
          currentLoggedInUserProfilePic={props.currentLoggedInUserProfilePic}
        />

        {
          userNotFoundContent ? (
            <h2 id="blogFeedContainer">User not Found 😟</h2>
          ) : (
            <section id="blogFeedContainer">
              {/* TITLE TEXT */}
              {
                queryStringID == props.currentLoggedInUserId ? (
                  <h2 className="universalHeader">
                    Your Profile
                  </h2>
                ) : (
                  <h2 className="universalHeader">
                    {allUserPosts.username}'s Profile
                  </h2>
                )
              }
              <article id="profileInformation">
                <section className="profileInformationItem">
                  <img
                    className="profileInformationPic"
                    id="defaultPfPic"
                    src={
                      allUserPosts?.userProfilePic
                        ? `${import.meta.env.VITE_SERVER}${allUserPosts.userProfilePic}`
                        : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
                    }
                    alt=""
                  />
                  <h1>{allUserPosts.username}</h1>
                </section>

                {
                  queryStringID == props.currentLoggedInUserId ? (
                    <>
                      <form
                        ref={formRef}
                        className="profileInformationItem"
                      >
                        <label
                          className="profilePictureSelectorLabel"
                          htmlFor="profilePictureSelector"
                        >
                          <i className="fa-solid fa-image"></i> Change Picture
                        </label>
                        <input
                          type="file"
                          id="profilePictureSelector"
                          style={{ display: "none" }}
                          onChange={changeProfilePicture}
                        />
                        <label
                          className="profilePictureSelectorLabel"
                          onClick={() => (window.location.href = "/create")}
                        >
                          <i className="fa-solid fa-plus"></i> Create
                        </label>
                      </form>
                      <h4 style={{ textAlign: "center", color: "lime" }}>
                        {successMessage}
                      </h4>
                    </>
                  ) : (
                    <span></span>
                  )
                }
              </article>

              {
                queryStringID == props.currentLoggedInUserId ? (
                  <h2 className="universalHeader">
                    Your Posts
                  </h2>
                ) : (
                  <h2 className="universalHeader">
                    {allUserPosts.username}'s Posts
                  </h2>
                )
              }

              {allUserPosts ? (
                <>
                  {/* Polls */}
                  {userPolls.length > 0 ? (
                    userPolls.map((poll, pollIndex) => (
                      <section key={poll?._id || pollIndex} className="postContainer animate__animated  animate__fadeInRight">
                        <div className="postHeader">
                          <span className="nameAndProfilePicContainer">
                            <img
                              className="profilePictures"
                              src={
                                poll.profilePic
                                  ? `${import.meta.env.VITE_SERVER}${poll.profilePic}`
                                  : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
                              }
                              alt=""
                            />
                            <h4 className="postAuthor" onClick={()=> window.location.href = `/profile?id=${poll.author_id}`}>
                              {poll.username}
                            </h4>
                          </span>
                          <span className="postTimestamp">
                            posted {timeAgo(poll.created)}
                          </span>
                        </div>
                        <h3>{poll?.question}</h3>
                        {poll?.options?.map((option) => (
                          <button
                            key={option.id}
                            onClick={() => {
                              trackPollNumber(poll?.id, option.id);
                            }}
                            className={
                              option.voters.includes(
                                props?.currentLoggedInUserId
                              )
                                ? "hasVoted"
                                : "pollOption"
                            }
                          >
                            {option.voters.includes(
                              props?.currentLoggedInUserId
                            ) ? (
                              <>
                                {option?.option_text}{" "}
                                <span>
                                  Voted{" "}
                                  <i className="fa-solid fa-check-double fa-xl"></i>
                                </span>
                              </>
                            ) : (
                              <span>{option?.option_text}</span>
                            )}
                            {option.user_voted} votes
                          </button>
                        ))}
                        <span className="checkAnswers">
                          <h4>{poll.totalVotes} votes</h4>
                        </span>

                        <LikeAndComment currentLoggedInUserId={props?.currentLoggedInUserId}
                          postInformation={poll}
                          postID={poll?.id}
                          postIndex={`poll-${pollIndex}`}
                          addLikeToPost={addLikeToPost}
                          commentSectionRef={commentContainerRef}
                          isPoll={poll?.isPoll}
                        />

                        <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[`poll-${pollIndex}`] = el)} >
                          <div className="commentContainer">

                            <span className="comment">
                              {
                                poll.comments.length > 0 ? (
                                  poll.comments.map((comment)=> {
                                    return (
                                      <>
                                        <div className="commentBlock">
                                          <div className="commentHeader">
                                            <section className="commentWhoPostedContainer">
                                              <img className="commentProfilePic" src={comment.profilePic ? `${import.meta.env.VITE_SERVER}${comment.profilePic}` : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`} alt="" />
                                              <h4 className="commentAuthor" onClick={()=> window.location.href = `/profile?id=${comment.author_id}`} >{comment.author_username}</h4>
                                            </section>
                                            <h5>{timeAgo(comment.created)}</h5>
                                          </div>
                                          <div className="commentText">
                                            <p>{comment.commentBody}</p>
                                          </div>
                                        </div>

                                      </>
                                    )
                                  }).reverse()
                                ) : (
                                  <span className="emptyPostContainer">No Comments!</span>
                                )


                              }
                            </span>
                          </div>

                          <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, poll.id, poll.isPoll)}>
                            <input type="text" required name="userComment" id="" placeholder="Leave a comment...  "/>
                            <button type="submit" className="postCommentBtn">Post <i className="fa-solid fa-paper-plane"></i></button>
                          </form>
                        </section>
                      </section>
                    ))
                  ) : (
                    <span></span>
                  )}

                  {/* Posts */}
                  {userPosts.length > 0 ? (
                    userPosts.map((post, postIndex) => (
                      <section key={post?._id || postIndex} className="postContainer animate__animated  animate__fadeInRight">
                        <div className="postHeader">
                          <span className="nameAndProfilePicContainer">
                            <img
                              className="profilePictures"
                              src={
                                post.profilePic
                                  ? `${import.meta.env.VITE_SERVER}${post.profilePic}`
                                  : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
                              }
                              alt=""
                            />
                            <h4 className="postAuthor" onClick={()=> window.location.href = `/profile?id=${post.author_id}`}>
                              {post.username}
                            </h4>
                          </span>
                          <span className="postTimestamp">
                            posted {timeAgo(post.created)}
                          </span>
                        </div>
                        <h3>{post?.title}</h3>
                        <p>{post?.body}</p>
                        {post.postPic && (
                          <>
                            {!postImgLoaded && <span className="loader"></span>}
                            <img
                              src={`${import.meta.env.VITE_SERVER}${post.postPic}`}
                              alt="postPic"
                              style={postImgLoaded ? {} : { display: "none" }}
                              onLoad={() => setpostImgLoaded(true)}
                              onError={() => setpostImgLoaded(true)}
                            />
                          </>
                        )}

                        <LikeAndComment currentLoggedInUserId={props?.currentLoggedInUserId}
                          postInformation={post}
                          postID={post?.id}
                          postIndex={`post-${postIndex}`}
                          addLikeToPost={addLikeToPost}
                          commentSectionRef={commentContainerRef}
                          isPoll={post?.isPoll}
                        />

                        <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[`post-${postIndex}`] = el)} >
                          <div className="commentContainer">
                            <span className="comment">
                              {
                                post.comments.length > 0 ? (
                                  post.comments.map((comment)=> (
                                    <div className="commentBlock" key={comment._id}>
                                      <div className="commentHeader" >
                                        <section className="commentWhoPostedContainer" >
                                          <img className="commentProfilePic" src={comment.profilePic ? `${import.meta.env.VITE_SERVER}${comment.profilePic}` : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`} alt="" />
                                          <h4 className="commentAuthor" onClick={()=> window.location.href = `/profile?id=${comment.author_id}`}>{comment.author_username}</h4>
                                        </section>
                                        <h5>{timeAgo(comment.created)}</h5>
                                      </div>
                                      <div className="commentText">
                                        <p>{comment.commentBody}</p>
                                      </div>
                                    </div>
                                  )).reverse()
                                ) : (
                                  <span className="emptyPostContainer">No Comments!</span>
                                )
                              }
                            </span>
                          </div>
                          <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, post.id, post.isPoll)}>
                            <input type="text" required name="userComment" id="" placeholder="Leave a comment...  "/>
                            <button type="submit" className="postCommentBtn">Post <i className="fa-solid fa-paper-plane"></i></button>
                          </form>
                        </section>
                      </section>
                    )).reverse()
                  ) : (
                    <span className="emptyPostContainer">You have no posts yet!</span>
                  )}
                </>
              ) : (
                <span>loading</span>
              )}
            </section>
          )
        }
      </main>
    </>
  );
}
