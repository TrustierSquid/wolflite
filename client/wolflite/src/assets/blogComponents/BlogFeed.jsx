import { useState, useEffect, useRef } from "react";
import SideNav from "../navbarComponents/SideNav";
import LikeAndComment from "../popupComponents/LikeAndComment";
import PopupInformation from "../popupComponents/PopupInformation";

export default function BlogFeed() {
  const [allPosts, setAllPosts] = useState({ posts: [], polls: [] });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [currentLoggedInUserName, setCurrentLoggedInUserName] = useState([]);
  const [currentLoggedInUserId, setCurrentLoggedInUserId] = useState([]);
  const [currentLoggedInUserProfilePic, setCurrentLoggedInUserProfilePic] = useState([]);
  const [animateIndex, setAnimateIndex] = useState(null)
  const commentContainerRef = useRef([])
  const postScrollRef = useRef(null)
  const pollScrollRef = useRef(null)



  // Fetches Posts and polls
  async function fetchAllPosts() {
    try {
      const response = await fetch("/post/fetch", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });

      if(response.status === 401) {
        window.location.href = "/login"
      }

      if (!response.ok) {
        throw new Error(`HTTP error! ${response.status}`);
      }

      const data = await response.json();
      setAllPosts(data);
    } catch (err) {
      console.log(err);
    }
  }



  // Run initially after component mount
  useEffect(() => {
    fetchAllPosts();
    getUserData();
  }, []);

  // Fetches the Username and UID for the logged in user
  async function getUserData() {
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

      const data = await response.json();
      setCurrentLoggedInUserName(data.currentUserName);
      setCurrentLoggedInUserId(data.currentUserID);
      setCurrentLoggedInUserProfilePic(data.currentUserPfPicture);
    } catch (error) {
      console.log(error);
    }
  }




  // Calculates the poll numbers (total votes, total votes for each option in a poll)
  async function addVote(pollID, optionID, isOpen) {
    if (!isOpen) return

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


      fetchAllPosts();
    } catch (err) {
      console.log(err);
    }
  }




  async function addLikeToPost(userID, postID, index, isPoll) {
    // Selecting which button to animate
    setAnimateIndex(index)

    try {
      const response = await fetch(`/post/addLike/${userID}/${postID}/${isPoll}`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({"authorOfLike": userID})
      })



      if (!response.ok) {
        throw new Error("Failed to send like");
      }

      const data = await response.json()
      fetchAllPosts()
      setTimeout(() => setAnimateIndex(null), 700);
    } catch (error) {
      console.log(error)
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
          commentAuthor: currentLoggedInUserId,
          postID: postIndex,
          isPoll: isPoll
        }
      )
    })

    e.target.reset();

    if(response.status === 401) {
      window.location.href = "/login"
    }

    fetchAllPosts()
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

  // redirects to a profile of choice (selected by userID)
  function goToProfile(userInQuestion){
    window.location.href = `/profile?id=${userInQuestion}`
  }

  const [isChecking, setIsChecking] = useState(false)
  const [pollInQuestion, setPollInQuestion] = useState([])

  // For keeping track of opening and closing the popup
  function viewPostInfo(){
    setIsChecking(prev => !prev)
  }




  return (
    <>
      <PopupInformation
        pollInfo={pollInQuestion}
        loggedInUserId={currentLoggedInUserId}
        loggedInUsername={currentLoggedInUserName}
        currentLoggedInUserProfilePic={currentLoggedInUserProfilePic}

        // bool to check if the user clicked on votes
        isOpen={isChecking}
        onClose={()=> setIsChecking(false)}
      />
      <main id="homeContainer">
        <SideNav
          loggedInUserId={currentLoggedInUserId}
          loggedInUsername={currentLoggedInUserName}
          currentLoggedInUserProfilePic={currentLoggedInUserProfilePic}
          postScrollRef={postScrollRef}
          pollScrollRef={pollScrollRef}
        />
        <section id="blogFeedContainer" className="animate__animated animate__fadeInRight">

          {
            allPosts ? (
              allPosts?.feed?.length > 0 ? (
                allPosts?.feed?.map((post, index) => (
                  <section
                  className="postContainer"
                  key={index}
                  >
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
                        <h4 className="postAuthor" onClick={()=> goToProfile(post.author_id)}>{post.username}</h4>
                      </span>

                      <span className="postTimestamp">
                        {timeAgo(post.created)}
                      </span>
                    </div>


                    {
                      // Checking to see if the post is a poll
                      post.isPoll ? (
                        <>
                          <h4 style={{ whiteSpace: "pre-wrap" }}>{post?.question}</h4>
                          {post?.options?.map((option) => {
                            return (
                              <>
                                <button
                                  onClick={() => {
                                    addVote(post?.id, option.id, post.isOpen);
                                  }}
                                  className={
                                    post?.isOpen ? (
                                      option.voters.includes(currentLoggedInUserId)
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
                                          background: option.voters.includes(currentLoggedInUserId)
                                            ? "#4caf50"
                                            : "#2196f3",
                                          width: post.totalVotes
                                            ? `${(option.user_voted / post.totalVotes) * 100}%`
                                            : "0%",
                                          height: "100%",
                                          transition: "width 0.4s",
                                        }}
                                      ></div>
                                    </div>
                                    <span className="votePercentage" style={{ display: "flex", justifyContent: "space-between" }}>
                                      <p>{option.user_voted} votes</p>
                                      <h4>
                                        {post.totalVotes
                                          ? `${((option.user_voted / post.totalVotes) * 100)}%`
                                          : "0%"}
                                      </h4>
                                    </span>


                                  </div>
                                </button>

                              </>
                            );
                          })}
                          <span className="checkAnswers">
                            <button className="viewVotes" onClick={()=> {viewPostInfo(post); setPollInQuestion(post)}}>{post.totalVotes} votes <i className="fa-solid fa-check-to-slot"></i></button>

                            {
                              post?.isOpen ? (
                                <></>
                              ) : (
                                <h4> <i className="fa-solid fa-lock"></i> Poll Closed</h4>
                              )
                            }
                          </span>
                        </>

                      ) : (
                        // IF NOT A POLL
                        <section
                          className="postContainer"
                          key={post?.id}
                        >
                          <h3>{post?.title}</h3>
                          <p>{post?.body}</p>
                          {post.filename && (
                            <>

                              {
                                post.filename.includes('.mp4') ? (
                                  <video controls className="postMedia">
                                    <source src={`${import.meta.env.VITE_SERVER}${post.filename}`} type="video/mp4" />
                                    Your browser does not support the video tag.
                                  </video>
                                ) : (
                                  <img
                                    className="postMedia"
                                    src={`${import.meta.env.VITE_SERVER}${post.filename}`}
                                    alt="Post"
                                    style={imgLoaded ? {} : { display: "none" }}
                                    onLoad={() => setImgLoaded(true)}
                                    onError={() => setImgLoaded(true)} // hide loader if fails
                                  />
                                )
                              }
                            </>
                          )}
                        </section>

                      )
                    }

                    <LikeAndComment currentLoggedInUserId={currentLoggedInUserId}
                      postInformation={post}
                      postID={post?.id}
                      postIndex={`${index}`}
                      addLikeToPost={addLikeToPost}
                      commentSectionRef={commentContainerRef}
                      isPoll={post?.isPoll}
                    />


                    <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[`${index}`] = el)} >
                      <div className="commentContainer">

                        <span className="comment">
                          {
                            post?.comments?.length > 0 ? (
                              post?.comments?.map((comment)=> {
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
                                        <i className="fa-solid fa-arrows-turn-right"></i>
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
                      <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, post.id, post.isPoll)}>
                        <img src={currentLoggedInUserProfilePic ? `${import.meta.env.VITE_SERVER}${currentLoggedInUserProfilePic}` : null} alt="pic" className="profilePictures" />
                        <input type="text" required name="userComment" placeholder="Leave a comment...  " className="commentInput"/>
                        <button type="submit" className="postCommentBtn">Post <i className="fa-solid fa-paper-plane"></i></button>
                      </form>
                    </section>


                  </section>
                ))
              ) : (
                <span className="emptyPostContainer">No posts yet!</span>
              )
            ) : (
              <span className="loader"></span>
            )
          }
        </section>
      </main>
    </>
  );
}
