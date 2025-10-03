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

  function goToProfile(userInQuestion){
    window.location.href = `/profile?id=${userInQuestion}`
  }

  const [isChecking, setIsChecking] = useState(false)
  const [pollInQuestion, setPollInQuestion] = useState([])

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

          {/* span tag for smooth scrolling */}
          <span id="pollView" ref={pollScrollRef}></span>
          <h2 className="universalHeader">Newest Polls </h2>
          {
            // Loading condition for fetching the posts from the server
            allPosts ? (
              <>
                {/* For Polls */}
                {allPosts?.polls?.length > 0 &&
                  allPosts?.polls
                    ?.map((poll, index) => {
                      return (
                        <>
                          <section
                            className="postContainer"
                            key={poll?.id || index}
                          >
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
                                <h5 className="postAuthor">{poll.username}</h5>
                              </span>

                              <span className="postTimestamp">
                                posted a poll {timeAgo(poll.created)}
                              </span>
                            </div>

                            <h4 style={{ whiteSpace: "pre-wrap" }}>{poll?.question}</h4>

                            {poll?.options?.map((option) => {
                              return (
                                <>
                                  <button
                                    onClick={() => {
                                      trackPollNumber(poll?.id, option.id);
                                    }}
                                    className={
                                      option.voters.includes(currentLoggedInUserId)
                                        ? "hasVoted"
                                        : "pollOption"
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
                                </>
                              );
                            })}

                            <span className="checkAnswers">
                              <button onClick={()=> {viewPostInfo(poll); setPollInQuestion(poll)}}>{poll.totalVotes} votes <i className="fa-solid fa-check-to-slot"></i></button>
                            </span>
                            <LikeAndComment currentLoggedInUserId={currentLoggedInUserId}
                              postInformation={poll}
                              postID={poll?.id}
                              postIndex={`poll-${index}`}
                              addLikeToPost={addLikeToPost}
                              commentSectionRef={commentContainerRef}
                              isPoll={poll?.isPoll}
                            />
                            <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[`poll-${index}`] = el)} >
                              <div className="commentContainer">

                                <span className="comment">
                                  {
                                    poll?.comments?.length > 0 ? (
                                      poll?.comments?.map((comment)=> {
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

                              <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, poll.id, poll.isPoll)}>
                                <input type="text" required name="userComment" id="" placeholder="Leave a comment...  "/>
                                <button type="submit" className="postCommentBtn">Post <i className="fa-solid fa-paper-plane"></i></button>
                              </form>
                            </section>


                          </section>



                        </>
                      );
                    })
                    .reverse()}

                {/* span tag for smooth scrolling */}
                <span id="#postView" ref={postScrollRef}></span>
                <br />
                <h2 className="universalHeader">Newest Posts</h2>
                {/* For Regular Posts */}
                {allPosts?.posts?.length > 0 ? (
                  allPosts.posts
                    .slice()
                    .reverse()
                    .map((post, index) => (
                      <section
                        className="postContainer"
                        key={post?.id}
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
                            <h5 className="postAuthor" onClick={()=> goToProfile(post.author_id)}>{post?.username} </h5>
                          </span>
                          <span className="postTimestamp">
                            posted {timeAgo(post.created)}
                          </span>
                        </div>
                        <h3>{post?.title}</h3>
                        <p>{post?.body}</p>
                        {post.filename && (
                          <>
                            {!imgLoaded && <span className="loader"></span>}

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


                        {/* Like and Comment sections */}
                        <LikeAndComment currentLoggedInUserId={currentLoggedInUserId}
                          postInformation={post}
                          postID={post.id}
                          postIndex={`post-${index}`}
                          addLikeToPost={addLikeToPost}
                          commentSectionRef={commentContainerRef}
                          isPoll={post?.isPoll}
                        />



                        <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[`post-${index}`] = el)} >
                          <div className="commentContainer">

                            <span className="comment">
                              {
                                post.comments.length > 0 ? (
                                  post.comments.map((comment)=> {
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

                          <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, post.id, post.isPoll)}>
                            <input type="text" required name="userComment" id="" placeholder="Leave a comment...  "/>
                            <button type="submit" className="postCommentBtn">Post <i className="fa-solid fa-paper-plane"></i></button>
                          </form>
                        </section>


                      </section>
                    ))
                ) : (
                  <span className="emptyPostContainer">No Posts yet!</span>
                )}
              </>
            ) : (
              <span className="loader"></span>
            )
          }
        </section>
      </main>
    </>
  );
}
