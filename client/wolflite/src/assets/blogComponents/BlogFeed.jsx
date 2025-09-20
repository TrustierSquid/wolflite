import { useState, useEffect, useRef } from "react";
import SideNav from "../navbarComponents/SideNav";
import LikeAndComment from "../popupComponents/LikeAndComment";

export default function BlogFeed() {
  const [allPosts, setAllPosts] = useState({ posts: [], polls: [] });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [currentLoggedInUserName, setCurrentLoggedInUserName] = useState([]);
  const [currentLoggedInUserId, setCurrentLoggedInUserId] = useState([]);
  const [currentLoggedInUserProfilePic, setCurrentLoggedInUserProfilePic] = useState([]);
  const [animateIndex, setAnimateIndex] = useState(null)
  const commentContainerRef = useRef([])




  // Fetches Posts and polls
  async function fetchAllPosts() {
    try {
      const response = await fetch("/post/fetch", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

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


  async function addLikeToPost(userId, postID, index) {
    // Selecting which button to animate
    setAnimateIndex(index)

    try {
      const response = await fetch(`/post/addLike/${userId}/${postID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({"authorOfLike": userId})
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
  async function addCommentToPost(e, postIndex) {
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
          postID: postIndex
        }
      )
    })

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

  return (
    <>
      <main id="homeContainer">
        <SideNav
          loggedInUserId={currentLoggedInUserId}
          loggedInUsername={currentLoggedInUserName}
          currentLoggedInUserProfilePic={currentLoggedInUserProfilePic}
        />
        <section id="blogFeedContainer" className="animate__animated animate__fadeInRight">
          {
            // Loading condition for fetching the posts from the server
            allPosts ? (
              <>
                {/* For Polls */}
                {allPosts?.polls?.length > 0 &&
                  allPosts?.polls
                    ?.map((poll, index) => {
                      return (
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
                                    ? `http://localhost:5000${poll.profilePic}`
                                    : "/src/assets/imgs/defaultUser.jpg"
                                }
                                alt=""
                              />
                              <h5 className="postAuthor">{poll.username}</h5>
                            </span>

                            <span className="postTimestamp">
                              posted a poll {timeAgo(poll.created)}
                            </span>
                          </div>

                          <h3>{poll?.question}</h3>

                          {poll?.options?.map((option) => {
                            return (
                              <>
                                <button
                                  onClick={() => {
                                    trackPollNumber(poll?.id, option.id);
                                  }}
                                  className={
                                    option.voters.includes(
                                      currentLoggedInUserId
                                    )
                                      ? "hasVoted"
                                      : "pollOption"
                                  }
                                >
                                  {option.voters.includes(
                                    currentLoggedInUserId
                                  ) ? (
                                    <>
                                      {option?.option_text}{" "}
                                      <span>
                                        Voted{" "}
                                        <i class="fa-solid fa-check-double fa-xl"></i>
                                      </span>
                                    </>
                                  ) : (
                                    <span>{option?.option_text}</span>
                                  )}
                                  {option.user_voted} votes
                                </button>
                              </>
                            );
                          })}

                          <span className="checkAnswers">
                            <h4>{poll.totalVotes} votes</h4>
                          </span>
                        </section>
                      );
                    })
                    .reverse()}
                <h2 className="universalHeader">Posts</h2>
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
                                  ? `http://localhost:5000${post.profilePic}`
                                  : `/src/assets/imgs/defaultUser.jpg`
                              }
                              alt=""
                            />
                            <h5 className="postAuthor">{post?.username} </h5>
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
                            <img
                              id="postImage"
                              src={`http://localhost:5000/${post.filename}`}
                              alt="Post"
                              style={imgLoaded ? {} : { display: "none" }}
                              onLoad={() => setImgLoaded(true)}
                              onError={() => setImgLoaded(true)} // hide loader if fails
                            />
                          </>
                        )}


                        {/* Like and Comment sections */}
                        <LikeAndComment currentLoggedInUserId={currentLoggedInUserId}
                          postInformation={post}
                          postID={post.id}
                          postIndex={index}
                          addLikeToPost={addLikeToPost}
                          commentSectionRef={commentContainerRef}
                        />



                        <section className="commentsElementContainer" ref={(el)=> (commentContainerRef.current[index] = el)} >
                          <div className="commentContainer">

                            {console.log(post)}

                            <span className="comment">
                              {
                                post.comments.map((comment)=> {
                                  return (
                                    <>
                                      <div className="commentBlock">
                                        <div className="commentHeader">
                                          <section className="commentWhoPostedContainer">
                                            <img className="commentProfilePic" src={comment.profilePic ? `http://localhost:5000${comment.profilePic}` : "/src/assets/imgs/defaultUser.jpg"} alt="" />
                                            <h4>{comment.author_username}</h4>
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
                              }
                            </span>
                          </div>

                          <form className="commentFunctions" onSubmit={(e) => addCommentToPost(e, post.id)}>
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
