import { useEffect, useState, useRef } from "react";
import SideNav from "../navbarComponents/SideNav";
import LikeAndComment from "../popupComponents/LikeAndComment";
import PopupInformation from "../popupComponents/PopupInformation";

export default function ProfileUI(props) {
  const [allUserPosts, setAllUserPosts] = useState([]);
  const [postImgLoaded, setpostImgLoaded] = useState(null);
  const formRef = useRef(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [animateIndex, setAnimateIndex] = useState(null);
  const commentContainerRef = useRef([])
  const [userNotFoundContent, setUserNotFoundContent] = useState(false)
  const postScrollRef = useRef(null)
  const pollScrollRef = useRef(null)

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
  async function addVote(pollID, optionID, isPollOpen) {
    // If the poll is closed, do nothing..
    if (!isPollOpen) return

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
        window.location.href = `/profile?id=${props.currentLoggedInUserId}`;
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

    try {
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

      e.target.reset()
      fetchProfilePosts()
      const data = await response.json()
    } catch (error) {
      console.log(error)
    }

  }


  async function closePoll(poll){
    let response = await fetch(`/profileInfo/closePoll/${poll.id}`, {
      method: 'DELETE',
    })

    let data = await response.json()
    console.log(data)
    fetchProfilePosts()
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


  // Separate arrays for polls and posts to avoid index overlap
  const userPolls = allUserPosts?.allUserPolls || [];
  const userPosts = allUserPosts?.allUserPosts || [];

  const userArchivedPolls = allUserPosts?.archivedPolls || [];
  const likedPosts = allUserPosts?.likedPosts || [];

  // throwing poll info in state when viewing total votes
  const [isChecking, setIsChecking] = useState(false)
  const [pollInQuestion, setPollInQuestion] = useState([])

  // Setting a state for checking if a popup is up or not
  function viewPostInfo(){
    setIsChecking(prev => !prev)
  }


  const [feedToView, setFeedToView] = useState('Posts')

  // Changes what feed is viewed on the profile page
  function viewFeed(feed){
    setFeedToView(`${feed}`)
  }

  console.log(allUserPosts)


  return (
    <>
      <PopupInformation
        pollInfo={pollInQuestion}
        loggedInUserId={props?.currentLoggedInUserId}
        loggedInUsername={props?.currentLoggedInUserName}
        currentLoggedInUserProfilePic={props?.currentLoggedInUserProfilePic}

        // bool to check if the user clicked on votes
        isOpen={isChecking}
        onClose={()=> setIsChecking(false)}
      />

      <article id="profileInformation" className="animate__animated animate__fadeInRight">
        <section className="profileInformationItemPicForm">
          <img
            className="profileInformationPic"
            id=""
            src={
              allUserPosts?.userProfilePic
                ? `${import.meta.env.VITE_SERVER}${allUserPosts.userProfilePic}`
                : `${import.meta.env.VITE_SERVER}/static/uploads/defaultUser.jpg`
            }
            alt=""
          />

          <div id="profileDetails">
            <span id="nameAndAT">
              <h2 id="profileDetailsUsername">{allUserPosts.username}</h2>
              <p id="profileDetailsHeader">@turdburglar</p>
              <h4 className="userPermissionAdmin">Admin</h4>
            </span>
            <p id="profileDetailsBio">Lorem, ipsum dolor sit amet consectetur adipisicing elit. Id, nulla doloribus rerum odit qui reprehenderit dolore repellendus alias adipisci possimus.</p>
            <h4 style={{ color: "Green", textAlign: "left" }}>
              {successMessage}
            </h4>
          </div>
        </section>

        <div id="profileStatusBar">
          {
            queryStringID == props.currentLoggedInUserId ? (
              <>
                <form
                  ref={formRef}
                  id="formButtonGroup"
                >
                  <div className="profileInformationItemButtonGroup ">
                    <label
                      className="profilePictureSelectorLabel"
                      htmlFor="profilePictureSelector"
                    >
                      <i className="fa-solid fa-image"></i> Change Profile Picture
                    </label>
                    <input
                      type="file"
                      id="profilePictureSelector"
                      style={{ display: "none" }}
                      onChange={changeProfilePicture}
                    />

                    <label className="profilePictureSelectorLabel" onClick={()=> window.location.href = '/settings'}><i className="fa-solid fa-gear"></i> Profile Settings</label>
                  </div>

                  <div className="userInformation">
                    <span className="userAnalyticsItem">
                      <h3><i className="fa-solid fa-user-group"></i> 324</h3>
                      <p className="analyticLabel">Friends</p>
                    </span>
                    <span className="userAnalyticsItem">
                      <h3><i className="fa-solid fa-paper-plane"></i> 30</h3>
                      <p className="analyticLabel">Posts</p>
                    </span>
                  </div>


                </form>
            </>
            ) : (
              <>
                <form action="" id="formButtonGroup">
                  <div className="userInformation">
                    <span className="userAnalyticsItem">
                      <h3><i className="fa-solid fa-user-group"></i> 324</h3>
                      <p className="analyticLabel">Friends</p>
                    </span>
                    <span className="userAnalyticsItem">
                      <h3><i className="fa-solid fa-paper-plane"></i> 30</h3>
                      <p className="analyticLabel">Posts</p>
                    </span>
                  </div>
                </form>
              </>
            )
          }
        </div>




      </article>

      <section className="profileInformationItem animate__animated animate__fadeInLeft">
        <div className="profileInformationItemButtonGroup">
          {/* Expired or closed polls */}

          <button className="profileControBtn" onClick={()=> viewFeed("Archived")}><i className="fa-solid fa-square-poll-horizontal"></i> Archived Polls</button>

          {/* Liked Posts */}
          <button className="profileControBtn" onClick={()=> viewFeed("Liked")}><i className="fa-solid fa-comment"></i> Liked Posts</button>
        </div>
        <div className="profileInformationItemButtonGroup">

          {/* View Polls */}
          <button className="profileControBtn" onClick={()=> viewFeed("Polls")}><i className="fa-solid fa-square-poll-horizontal"></i> Polls</button>

          {/* View Posts  */}
          <button className="profileControBtn" onClick={()=> viewFeed("Posts")}><i className="fa-solid fa-comment"></i> Posts</button>
        </div>
      </section>

      <main id="homeContainer">
        <SideNav
          loggedInUserId={props.currentLoggedInUserId}
          loggedInUsername={props.currentLoggedInUsername}
          currentLoggedInUserProfilePic={props.currentLoggedInUserProfilePic}
          postScrollRef={postScrollRef}
          pollScrollRef={pollScrollRef}
        />

        {
          userNotFoundContent ? (
            <h2 id="blogFeedContainer">User not Found 😟</h2>
          ) : (
            <section id="blogFeedContainer">
              {/* TITLE TEXT */}

              {allUserPosts ? (
                <>
                  {/* span tag for smooth scrolling */}

                  {
                    queryStringID == props.currentLoggedInUserId ? (
                      <h2 className="universalHeader">
                        {feedToView === `Posts` ? `Your Posts` : feedToView === "Polls" ? `Your Polls` : feedToView === "Archived" ? `Your Archived Posts` :  feedToView === 'Liked' ? `Your Liked Posts` : "Liked"}
                      </h2>
                    ) : (
                      <h2 className="universalHeader">
                        {feedToView === `Posts` ? `${allUserPosts.username}'s Posts` : feedToView === "Polls" ? `${allUserPosts.username}'s Polls` : feedToView === "Archived" ? `${allUserPosts.username}'s Archived Posts` : "Archived"}
                      </h2>
                    )
                  }

                    <span id="pollView" ref={pollScrollRef}></span>
                    {/* Polls */}

                    {
                      feedToView === 'Polls' ? (
                        userPolls.length > 0 ? (
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
                              <h4>{poll?.question}</h4>

                              {poll?.options?.map((option) => (

                                <button
                                  key={option.id}
                                  onClick={() => {
                                    addVote(poll?.id, option.id, poll.isOpen);
                                  }}

                                  className={
                                    poll.isOpen ? (
                                      option.voters.includes(
                                        props?.currentLoggedInUserId
                                      )
                                        ? "hasVoted"
                                        : "pollOption"
                                    ) : (
                                      "pollClosed"
                                    )

                                  }
                                >
                                  <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                    <h5 className="optionText">{option?.option_text}</h5>


                                    {/* Progress bar */}
                                    <div
                                      style={{
                                        background: "#e0e0e0",
                                        borderRadius: "8px",
                                        height: "8px",
                                        width: "100%",
                                        margin: "8px 0",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <div
                                        style={{
                                          background: option.voters.includes(props?.currentLoggedInUserId)
                                            ? "#4caf50"
                                            : "#2196f3",
                                          width: poll.totalVotes
                                            ? `${(option.user_voted / poll.totalVotes) * 100}%`
                                            : "0%",
                                          height: "100%",
                                          transition: "width 0.4s",
                                        }}
                                      ></div>
                                    </div>
                                    <span className="votePercentage" style={{ display: "flex", justifyContent: "space-between" }}>
                                      <p>{option.user_voted} votes</p>
                                      <h4>
                                        {poll.totalVotes
                                          ? `${((option.user_voted / poll.totalVotes) * 100)}%`
                                          : "0%"}
                                      </h4>
                                    </span>


                                  </div>

                                </button>
                              ))}
                              <span className="checkAnswers">
                                <button className="viewVotes" onClick={()=> {viewPostInfo(poll); setPollInQuestion(poll)}}>{poll.totalVotes} votes <i className="fa-solid fa-check-to-slot"></i></button>

                                {
                                  poll?.isOpen ? (
                                    queryStringID == props.currentLoggedInUserId ? (
                                      <button className="closePollButton" onClick={()=> closePoll(poll)}><i className="fa-solid fa-circle-xmark"></i> Close Poll</button>
                                    ) : (
                                      <span></span>
                                    )
                                  ) : (
                                    <>
                                      <h4> <i className="fa-solid fa-lock"></i> Poll Closed</h4>
                                      <h4></h4>
                                    </>
                                  )
                                }

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

                          )).reverse()
                        ) : (
                          <span className="emptyPostContainer">No polls yet!</span>
                        )

                      ) : (
                        <></>
                      )
                    }

                    {
                      feedToView === 'Archived' ? (
                        userArchivedPolls.length > 0 ? (
                          userArchivedPolls.map((poll, pollIndex) => (
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
                              <h4>{poll?.question}</h4>

                              {poll?.options?.map((option) => (

                                <button
                                  key={option.id}
                                  onClick={() => {
                                    addVote(poll?.id, option.id, poll.isOpen);
                                  }}

                                  className={
                                    poll.isOpen ? (
                                      option.voters.includes(
                                        props?.currentLoggedInUserId
                                      )
                                        ? "hasVoted"
                                        : "pollOption"
                                    ) : (
                                      "pollClosed"
                                    )

                                  }
                                >
                                  <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
                                    <h5 className="optionText">{option?.option_text}</h5>


                                    {/* Progress bar */}
                                    <div
                                      style={{
                                        background: "#e0e0e0",
                                        borderRadius: "8px",
                                        height: "8px",
                                        width: "100%",
                                        margin: "8px 0",
                                        overflow: "hidden",
                                      }}
                                    >
                                      <div
                                        style={{
                                          background: option.voters.includes(props?.currentLoggedInUserId)
                                            ? "#4caf50"
                                            : "#2196f3",
                                          width: poll.totalVotes
                                            ? `${(option.user_voted / poll.totalVotes) * 100}%`
                                            : "0%",
                                          height: "100%",
                                          transition: "width 0.4s",
                                        }}
                                      ></div>
                                    </div>
                                    <span className="votePercentage" style={{ display: "flex", justifyContent: "space-between" }}>
                                      <p>{option.user_voted} votes</p>
                                      <h4>
                                        {poll.totalVotes
                                          ? `${((option.user_voted / poll.totalVotes) * 100)}%`
                                          : "0%"}
                                      </h4>
                                    </span>


                                  </div>

                                </button>
                              ))}
                              <span className="checkAnswers">
                                <button className="viewVotes" onClick={()=> {viewPostInfo(poll); setPollInQuestion(poll)}}>{poll.totalVotes} votes <i className="fa-solid fa-check-to-slot"></i></button>

                                {
                                  poll?.isOpen ? (
                                    queryStringID == props.currentLoggedInUserId ? (
                                      <button className="closePollButton" onClick={()=> closePoll(poll)}><i className="fa-solid fa-circle-xmark"></i> Close Poll</button>
                                    ) : (
                                      <span></span>
                                    )
                                  ) : (
                                    <>
                                      <h4 className="animate__animated animate__headShake"><i className="fa-solid fa-lock"></i> Poll Closed</h4>
                                      <h4></h4>
                                    </>
                                  )
                                }

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
                          )).reverse()
                        ) : (
                          <span className="emptyPostContainer">No archived Posts!</span>
                        )
                      ) : (
                        <></>
                      )
                    }

                  {/* span tag for smooth scrolling */}
                  <span id="postView" ref={postScrollRef}></span>

                  {/*Profile Posts */}

                  {
                    feedToView === 'Liked' ? (
                      likedPosts.length > 0 ? (
                        likedPosts.map((post, postIndex) => (
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
                                {/* {!postImgLoaded && <span className="loader"></span>} */}

                                {
                                  post.postPic.includes('.mp4') ? (
                                    <video controls className="postMedia">
                                      <source src={`${import.meta.env.VITE_SERVER}${post.postPic}`} type="video/mp4" />
                                      Your browser does not support the video tag.
                                    </video>
                                  ) : (
                                    <img
                                      src={`${import.meta.env.VITE_SERVER}${post.postPic}`}
                                      alt="postPic"
                                      style={postImgLoaded ? {} : { display: "none" }}
                                      onLoad={() => setpostImgLoaded(true)}
                                      onError={() => setpostImgLoaded(true)}
                                    />
                                  )
                                }

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
                        ))
                      ) : (
                        <span className="emptyPostContainer">No Liked Posts!</span>
                      )

                    ): (
                      <></>
                    )
                  }

                  {
                    feedToView === 'Posts' ? (
                      userPosts.length > 0 ? (
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
                                {/* {!postImgLoaded && <span className="loader"></span>} */}

                                {
                                  post.postPic.includes('.mp4') ? (
                                    <video controls className="postMedia">
                                      <source src={`${import.meta.env.VITE_SERVER}${post.postPic}`} type="video/mp4" />
                                      Your browser does not support the video tag.
                                    </video>
                                  ) : (
                                    <img
                                      src={`${import.meta.env.VITE_SERVER}${post.postPic}`}
                                      alt="postPic"
                                      style={postImgLoaded ? {} : { display: "none" }}
                                      onLoad={() => setpostImgLoaded(true)}
                                      onError={() => setpostImgLoaded(true)}
                                    />
                                  )
                                }

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
                        <span className="emptyPostContainer">No posts yet!</span>
                      )
                    ) : (
                      <></>
                    )
                  }
                </>
              ) : (
                <span className="loader"></span>
              )}
            </section>
          )
        }
      </main>
    </>
  );
}
