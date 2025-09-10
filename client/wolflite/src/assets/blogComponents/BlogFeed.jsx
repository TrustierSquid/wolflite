import { useState, useEffect, useRef } from "react";

export default function BlogFeed() {
  const [allPosts, setAllPosts] = useState({posts: [], polls: []});
  const [imgLoaded, setImgLoaded] = useState(false);
  const pollRef = useRef(null);
  const [currentLoggedInUserName, setCurrentLoggedInUserName] = useState([])
  const [currentLoggedInUserId, setCurrentLoggedInUserId] = useState([])

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
    getUserData()
  }, []);

  // Fetches the Username and UID for the logged in user
  async function getUserData(){
    try {
      const response = await fetch('/getUserData', {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! ${response.status}`);
      }

      const data = await response.json()
      setCurrentLoggedInUserName(data[0].currentUserName.username)
      setCurrentLoggedInUserId(data[1].currentUserID)
    } catch (error) {
      console.log(error)
    }
  }


  // Calculates the poll numbers (total votes, total votes for each option in a poll)
  async function trackPollNumber(pollID, optionID){
    try {
      // Sends the poll id and calculates the percentage of users that have selected an answer for each poll
      const response = await fetch('/post/poll/userStats', {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({"pollID": pollID, "optionID": optionID})
      });

      if (!response.ok) {
        throw new Error(`HTTP error! ${response.status}`);
      }

      const data = await response.json()

      /*
        If the user tries to vote again and the client receives an error from the server
        Preventing the User from spamming the api endpoint and voting more than once.
       */
      if (data.error) {
        alert(data.error + ". Start a new Poll or wait for this one to expire.")
      }

      fetchAllPosts()
    } catch (err) {
      console.log(err)
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
        <section id="profileSection">
          <div id="userInformation">
            <h3>Welcome back <span style={{color: "crimson"}}>{currentLoggedInUserName}!</span></h3>
            <h5 style={{color: "grey", textAlign: "center"}}>UserID#: {currentLoggedInUserId}</h5>
            <br />
            <article id="sideNavButtonContainer">
              <button className="sideNavButton" onClick={()=> window.location.href = '/blog'}>Home</button>
              <button className="sideNavButton" onClick={()=> window.location.href = '/'}>Logout <i className="fa-light fa-left-from-bracket" style={{color: "#ffffff;"}}></i></button>
            </article>
            <button className="sideNavButton" onClick={()=> window.location.href = '/create'}>Create Post +</button>
            <button className="sideNavButton" onClick={()=> window.location.href = '/create'}>Changelog</button>
          </div>
        </section>
        <section id="blogFeedContainer">
          {
            // Loading condition for fetching the posts from the server
            allPosts ? (
              <>
                {allPosts?.polls?.length > 0 &&
                  allPosts?.polls?.map((poll, index) => {


                    return (
                      <section
                        className="postContainer"
                        key={poll?.id}
                      >
                        <h5 className="postAuthor">
                          {poll?.username} <span>posted a poll {timeAgo(poll.created)}</span>
                        </h5>
                        <h3>{poll?.question}</h3>

                        {poll?.options?.map((option)=> {
                          return (
                            <>
                              <button onClick={()=> {trackPollNumber(poll?.id, option.id)}}
                              // If the user votes, the class changes reflecting that user voted
                              // If not, the class remains the same
                              className={option.voters.includes(currentLoggedInUserId) ? "hasVoted" : "pollOption"}
                              >
                                 {
                                  option.voters.includes(currentLoggedInUserId) ? (
                                    <>
                                      {option?.option_text} <span>Voted <i class="fa-solid fa-check-double fa-xl"></i></span>
                                    </>
                                  ) : (
                                    <span>
                                      {option?.option_text}
                                    </span>
                                  )
                                }
                                {option.user_voted} votes
                              </button>
                            </>
                          )
                        })}


                        <span className="checkAnswers">
                          <h4>{poll.totalVotes} votes</h4>
                        </span>
                      </section>
                    )
                  }).reverse()
                }

                {allPosts?.posts?.length > 0 ? (
                  allPosts.posts
                    .slice()
                    .reverse()
                    .map((post) => (
                      <section
                        className="postContainer"
                        key={post?.id}
                      >
                        <h5 className="postAuthor">
                          {post?.username} <span>posted {timeAgo(post.created)}</span>
                        </h5>
                        <h3>{post?.title}</h3>

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

                        <p>{post?.body}</p>
                      </section>
                    ))
                ) : (
                  <span>No Posts yet!</span>
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
